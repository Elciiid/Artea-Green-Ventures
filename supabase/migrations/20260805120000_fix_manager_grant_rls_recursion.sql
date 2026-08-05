-- Task 1 (companies access model) — fix an RLS-recursion bug in the two
-- manager-facing policies added by 20260805100000_agv_companies.sql.
--
-- Found by the task's own adversarial verification, specifically the
-- positive control that's supposed to prove a LEGITIMATE manager grant
-- succeeds (not just that illegitimate ones fail): a real manager, with a
-- real in-company target profile and a real in-scope application, had
-- "access — manager grant within company scope" reject the insert with
-- 42501 every time.
--
-- Root cause: that policy's with check (and the sibling revoke policy's
-- using/with check) embed
--
--   exists (select 1 from public.agv_profiles target where ...)
--   exists (select 1 from public.agv_company_applications sca where ...)
--
-- directly inside a plain (non-SECURITY DEFINER) RLS policy. A policy's
-- USING/WITH CHECK expression runs as the invoking role (the signed-in
-- manager, i.e. `authenticated`), so any subquery inside it is ITSELF
-- subject to RLS on the table it reads. Neither agv_profiles nor
-- agv_company_applications has a policy letting a non-admin, non-owner
-- read an arbitrary row — agv_profiles only allows own-row read or admin
-- read; agv_company_applications is admin-only, full stop. So both
-- exists() checks silently saw zero rows for a manager, no matter how
-- correct the data was, and the policy could never pass for anyone but an
-- admin (who doesn't need it — "access — admin all" already covers them).
-- Confirmed directly: signed in as the manager, `select id, company_id
-- from agv_profiles where id = <teammate>` and `select id from
-- agv_company_applications where company_id = <own company>` both
-- returned zero rows even though the rows existed and the data was
-- correct — this is exactly the class of gotcha agv_is_admin(),
-- agv_has_app_access(), and agv_manager_company_id() itself already exist
-- to route around (all three are SECURITY DEFINER for precisely this
-- reason); the two manager policies just didn't route their table reads
-- through an equivalent helper.
--
-- Fix: two new SECURITY DEFINER helper predicates, same pattern, so the
-- membership/scope checks read past RLS on their target tables instead of
-- through it. The logical conditions are UNCHANGED from
-- 20260805100000 — only how they're evaluated.

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
  );
$$;

create or replace function public.agv_application_in_manager_company_scope(target_application uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_company_applications sca
    where sca.application_id = target_application
      and sca.company_id = public.agv_manager_company_id()
      and sca.revoked_at is null
  );
$$;

drop policy if exists "access — manager grant within company scope" on public.agv_application_access;
create policy "access — manager grant within company scope"
  on public.agv_application_access
  for insert
  with check (
    agv_manager_company_id() is not null
    and agv_profile_in_manager_company(profile_id)
    and agv_application_in_manager_company_scope(application_id)
  );

drop policy if exists "access — manager revoke within company" on public.agv_application_access;
create policy "access — manager revoke within company"
  on public.agv_application_access
  for update
  using (
    agv_manager_company_id() is not null
    and agv_profile_in_manager_company(profile_id)
  )
  with check (
    agv_manager_company_id() is not null
    and agv_profile_in_manager_company(profile_id)
  );
