-- Task 1 (companies access model) — extend the existing self-escalation
-- guard on agv_profiles to also cover the two new columns.
--
-- "own profile — update" (10a) checks only auth.uid() = id, not which
-- columns change. This project has already found and fixed this exact gap
-- twice on this same table: agv_prevent_self_role_escalation
-- (20260725100000, guards role/organization_id) and, on agv_applications,
-- agv_prevent_staff_application_tamper (20260728120000). company_id and
-- is_company_manager (added in 20260805100000) are new columns on the SAME
-- agv_profiles table with the SAME own-row-update policy — without this
-- guard, any signed-in client could PATCH their own row directly via the
-- Supabase client and set is_company_manager = true themselves, a live
-- privilege escalation that would bypass every check the companies model
-- adds.
--
-- Fix: widen agv_prevent_self_role_escalation's existing function body
-- (create or replace — the trigger is already attached to agv_profiles, so
-- only the function needs to change) to also reject a change to company_id
-- or is_company_manager unless the actor is agv_is_admin() or has no JWT
-- subject at all (auth.uid() is null — the service-role key), exactly the
-- same allowance the function already makes for role/organization_id.
--
-- Extending the existing function rather than adding a third parallel
-- trigger keeps one place enforcing "these agv_profiles columns are
-- admin/service-role only," rather than near-duplicate triggers drifting
-- independently — the same call this project already made when it
-- consolidated other near-duplicates.

create or replace function public.agv_prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.role is distinct from old.role
    or new.organization_id is distinct from old.organization_id
    or new.company_id is distinct from old.company_id
    or new.is_company_manager is distinct from old.is_company_manager
  ) then
    if auth.uid() is not null and not public.agv_is_admin() then
      raise exception 'Only admins may change role, organization_id, company_id, or manager status.';
    end if;
  end if;
  return new;
end;
$$;

-- The trigger itself (agv_profiles_prevent_role_escalation, before update
-- on agv_profiles) is unchanged — it already points at this function name,
-- so create or replace above is sufficient. Re-stated here only so this
-- migration is self-documenting about what's actually in effect afterward.
