-- Task 1 (companies access model) — final hardening pass from the task
-- reviewer's last review round. Both known privilege-escalation vectors on
-- agv_application_access (20260805140000, 20260805150000) were confirmed
-- closed with no third vector found; these are two smaller, non-Critical
-- items the reviewer flagged as cheap enough to close now rather than
-- defer. Neither is an access-control escalation on its own — see each
-- item below — but both are real gaps worth closing before this task
-- signs off.

-- ————————————————————————————————————————————————————————————————
-- 1. (Moderate) agv_application_access's tamper-guard trigger doesn't
-- guard `id`. A manager holding a visible, writable grant row could issue
-- .update({ id: '<new-uuid>' }).eq('id', '<visible-row>') — this passes
-- RLS (profile_id unchanged) and passes the existing trigger (which never
-- looks at id). Not a privilege escalation itself (application_id,
-- profile_id, and revoked_at — the columns that actually determine what
-- the row MEANS — stay frozen), but it corrupts the row's own identity:
-- agv_write_audit's audit-log rows record row_pk = new.id, so rotating id
-- breaks the audit trail's link to this row's history, and
-- revokeAccess() in src/lib/supabase/access.ts operates by id, so a
-- rotated id can make a legitimate revoke silently target a row that no
-- longer exists under the id the caller thinks it has.
--
-- Fix: extend the SAME trigger function already extended twice
-- (20260805140000, 20260805150000) — create or replace, not a new
-- trigger — adding `id` to the guarded-columns OR-chain.

create or replace function public.agv_prevent_application_access_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.id is distinct from old.id
    or new.application_id is distinct from old.application_id
    or new.profile_id is distinct from old.profile_id
    or new.granted_at is distinct from old.granted_at
    or (old.revoked_at is not null and new.revoked_at is null)
  ) then
    if auth.uid() is not null and not public.agv_is_admin() then
      raise exception 'Only admins may change id, application_id, profile_id, or granted_at on an access grant, or un-revoke a revoked grant.';
    end if;
  end if;
  return new;
end;
$$;

-- ————————————————————————————————————————————————————————————————
-- 2. (Low, defense-in-depth) agv_profile_in_manager_company() has no role
-- filter on the target profile. Today every profile with a company_id
-- assigned is expected to be a client, but nothing in the schema enforces
-- that — company_id and role are independent columns. If a future admin
-- action (e.g. Task 2's admin UI) ever assigns company_id to a staff
-- account by mistake, a manager could grant that staff account an
-- agv_application_access row, which — combined with agv_applications'
-- existing "applications — staff write granted" policy
-- (20260723090000, agv_is_staff() and a live grant) — would hand that
-- staff account real UPDATE rights on an application via a path never
-- intended to reach staff at all. Cheap to close now, before Task 2's UI
-- makes that misconfiguration reachable in practice: restrict the
-- helper's target match to role = 'client'.

create or replace function public.agv_profile_in_manager_company(target_profile uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_profiles target
    where target.id = target_profile
      and target.company_id = public.agv_manager_company_id()
      and target.role = 'client'
  );
$$;

-- (Item 3 from this same review round — a missing `drop policy if exists`
-- in 20260805130000_manager_read_within_company.sql — is a file-hygiene
-- fix only, made directly in that file rather than here, since the policy
-- it concerns is already correctly live and nothing about its behavior
-- changes; the fix only matters for a future fresh replay of the
-- migration history.)
