-- Task 2 (companies admin page) — whole-branch review finding, mirror side
-- of 20260805160000's item 2.
--
-- 20260805160000 added `and target.role = 'client'` to
-- agv_profile_in_manager_company(), so a manager can't be granted access
-- FOR a staff account (the TARGET side of a grant). But
-- agv_manager_company_id() — the function that decides whether the CALLER
-- is acting as a manager at all — was never given the same filter. It
-- checks is_company_manager/company_id but not the caller's own role.
--
-- Nothing in this schema stops company_id/is_company_manager from being set
-- on a staff profile (they're independent columns, same as the target-side
-- gap 20260805160000 closed), and Task 2's new
-- src/app/api/admin/set-company/route.ts doesn't validate the target
-- profile's role either — it only checks the CALLER is admin, not what role
-- the profile being updated has. src/lib/supabase/companies.ts's
-- fetchClientProfiles() filters to role = 'client' client-side, but that's
-- a UI convenience, not a barrier: an admin POSTing directly to
-- /api/admin/set-company with a staff profile's id and
-- isCompanyManager: true would make that staff account agv_manager_company_id()
-- returns non-null for. Combined with agv_application_access's manager
-- grant/revoke policies (20260805100000/20260805120000), that staff account
-- would gain real INSERT/UPDATE reach on agv_application_access — a table
-- staff has no other write access to at all, reached via a path never
-- intended for staff. Same misconfiguration class as 20260805160000's item
-- 2, just on the caller side instead of the target side.
--
-- Not reachable from Task 2's UI (which only ever offers client-role
-- profiles as roster/manager candidates) and requires an admin to
-- deliberately misuse the API directly — defense-in-depth, not a live
-- exploit. Fix: extend the SAME function (create or replace, not a new
-- one), adding role = 'client' to its existing where clause, exactly as
-- 20260805160000 did for agv_profile_in_manager_company().

create or replace function public.agv_manager_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.agv_profiles
  where id = auth.uid()
    and is_company_manager = true
    and company_id is not null
    and role = 'client';
$$;
