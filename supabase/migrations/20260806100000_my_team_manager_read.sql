-- My Team (client-manager grant/revoke page) — the manager-facing READ
-- policies this task's brief called out as the expected backend work: a
-- manager needs to see their own company's live application scope (the
-- "which applications can I grant" ceiling) and their own company's client
-- roster, neither of which any existing policy exposes to a non-admin.
-- Both follow the exact SECURITY DEFINER helper pattern already established
-- and proven throughout the Companies work (agv_manager_company_id() is
-- SECURITY DEFINER, so it reads past RLS internally with no recursion risk —
-- same reasoning as agv_is_admin() being called from "profiles — admin
-- read", and as the fix in 20260805120000 for the two manager policies that
-- originally got this wrong on agv_application_access).

-- A manager may read their own company's live application scope — needed
-- to show My Team's "which applications can I grant" list.
create policy "company applications — manager read own company"
  on public.agv_company_applications
  for select
  using (
    agv_manager_company_id() is not null
    and company_id = agv_manager_company_id()
  );

-- A manager may read fellow same-company CLIENT profiles — needed to show
-- My Team's roster. Filtered to role = 'client' for the same defense-in-
-- depth reason agv_manager_company_id() and agv_profile_in_manager_company()
-- already filter on role — a manager should never see a staff/admin row
-- through this policy even in a hypothetical company_id misconfiguration.
create policy "profiles — manager read own company"
  on public.agv_profiles
  for select
  using (
    agv_manager_company_id() is not null
    and company_id = agv_manager_company_id()
    and role = 'client'
  );

-- ————————————————————————————————————————————————————————————————
-- A third policy, beyond the two the brief specified — added here because
-- building the UI surfaced a real gap, not because the brief was wrong to
-- enumerate only two: agv_applications' only non-admin SELECT policy is
-- "applications — user read granted" (agv_has_app_access(id) — a LIVE
-- PERSONAL grant for the caller). A manager viewing their company's
-- application-scope "ceiling" has no guarantee they personally hold a grant
-- for every application in that scope — the ceiling is meant to include
-- applications nobody has been granted yet, that's the whole point of a
-- ceiling. Without this policy, fetchApplicationsForAccess() (reused as-is
-- from access.ts, per the brief's own guidance not to duplicate query logic)
-- would silently return zero rows for any in-scope application the manager
-- hasn't personally been granted, and My Team's checklist would have no
-- title/reference to render for it — not a rejected write, just an
-- invisible row, the same silent-gap failure mode 20260805130000 already
-- documented once for a different table.
--
-- Reuses agv_application_in_manager_company_scope() (SECURITY DEFINER,
-- already defined in 20260805120000 for the sibling
-- agv_application_access manager-grant policy) rather than inlining a new
-- exists() check — same condition, same helper, no new logic.
create policy "applications — manager read company scope"
  on public.agv_applications
  for select
  using (
    agv_manager_company_id() is not null
    and agv_application_in_manager_company_scope(id)
  );
