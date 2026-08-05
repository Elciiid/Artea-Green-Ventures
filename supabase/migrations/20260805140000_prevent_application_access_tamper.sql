-- Task 1 (companies access model) — close a column-restriction gap on
-- agv_application_access's manager-facing UPDATE policy.
--
-- Found by the task reviewer during review of 20260805120000/20260805130000
-- (not independently found during this task's own adversarial pass — logged
-- here as its own incident so the full trail is honest about where it came
-- from): "access — manager revoke within company"'s USING/WITH CHECK only
-- constrain profile_id (the row must belong to a same-company teammate,
-- both before and after the update). Neither clause constrains
-- application_id. Postgres RLS does not implicitly restrict which COLUMNS
-- an UPDATE touches — row-level policies gate which ROWS are visible/
-- writable, not which fields on an already-writable row change. So a
-- manager holding a visible, writable grant row (one they legitimately
-- granted, or any teammate's grant visible to them per the
-- 20260805130000 SELECT policy) could issue:
--
--   supabase.from('agv_application_access')
--     .update({ application_id: '<any application outside company scope>' })
--     .eq('id', '<an existing, visible grant row>')
--
-- USING passes (profile_id is unchanged, still a same-company teammate).
-- WITH CHECK passes (same — it never looks at application_id either).
-- This reaches exactly the outcome adversarial test (b) was built to
-- block — granting an out-of-scope application to a teammate — just via
-- UPDATE instead of INSERT, so it was never exercised by that INSERT-only
-- test. It also lets a manager resurrect an old, out-of-scope grant
-- (revoked_at back to null) for the same reason: the SELECT/UPDATE
-- policies are application-agnostic.
--
-- This is the SAME bug class this project has now found four times on
-- three different tables — an own-row/granted-row policy that checks WHO
-- (or, here, which teammate) but not WHICH COLUMNS actually change:
-- agv_prevent_self_role_escalation (agv_profiles: role, organization_id,
-- then company_id/is_company_manager) and
-- agv_prevent_staff_application_tamper (agv_applications: every
-- non-stage column). Fix: the same pattern, applied here — a BEFORE
-- UPDATE trigger that rejects a change to application_id, profile_id, or
-- granted_at unless the actor is agv_is_admin() or has no JWT subject at
-- all (auth.uid() is null — the service-role key). This restricts a
-- non-admin's UPDATE to ONLY ever touching revoked_at — the one column
-- the legitimate revoke path (revokeAccess() in
-- src/lib/supabase/access.ts) actually writes — while leaving admin's
-- existing full-row access via "access — admin all" untouched.

create or replace function public.agv_prevent_application_access_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.application_id is distinct from old.application_id
    or new.profile_id is distinct from old.profile_id
    or new.granted_at is distinct from old.granted_at
  ) then
    if auth.uid() is not null and not public.agv_is_admin() then
      raise exception 'Only admins may change application_id, profile_id, or granted_at on an access grant.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agv_application_access_prevent_tamper on public.agv_application_access;
create trigger agv_application_access_prevent_tamper
  before update on public.agv_application_access
  for each row execute function public.agv_prevent_application_access_tamper();
