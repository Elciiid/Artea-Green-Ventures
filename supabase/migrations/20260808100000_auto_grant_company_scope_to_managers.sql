-- Backend tweak (2026-08-08) — the admin Access tab now grants applications
-- to a COMPANY instead of an individual client (clients "live" inside a
-- company now, per direct product decision), and access granted to a
-- company must automatically reach that company's manager(s) — not require
-- the manager to separately self-grant via My Team, and not require the
-- admin to remember to also grant the manager personally.
--
-- Two triggers implement this as a real DB invariant, not an application-
-- layer convention that only holds if every call site remembers to do both
-- writes — the same reasoning this project has already applied to every
-- other cross-table consistency rule on agv_application_access /
-- agv_company_applications (see 20260805100000 onward). Both triggers are
-- SECURITY DEFINER (same pattern as agv_write_audit, agv_is_admin, etc.),
-- so they can write agv_application_access rows regardless of who/what
-- performed the triggering write (an admin's own anon-bound client, or the
-- service-role /api/admin/set-company route).
--
-- Deliberately ONE-DIRECTIONAL, matching this app's existing "company scope
-- is a ceiling, not retroactive" philosophy (see CompanyDetail.tsx's own
-- Application-scope copy, corrected in this same change): granting scope
-- to a company auto-grants its current manager(s); REVOKING a company's
-- scope does NOT auto-revoke any manager's already-issued personal grant,
-- exactly like it already doesn't retroactively narrow what a manager may
-- have already granted their own teammates. An admin who wants to pull a
-- manager's access back does so explicitly (there's no UI for that yet on
-- this pass — flagged, not built, since it wasn't asked for).
--
-- Idempotent by construction: both INSERTs target
-- agv_application_access_live_uidx (application_id, profile_id) where
-- revoked_at is null (10b-1) via ON CONFLICT ... DO NOTHING, so a manager
-- who already holds a live grant (however it got there) is left untouched
-- rather than erroring the whole triggering statement.

-- ————————————————————————————————————————————————————————————————
-- Trigger 1 — a company's scope grows: auto-grant every CURRENT manager.
-- ————————————————————————————————————————————————————————————————
--
-- Fires only on INSERT (agv_company_applications rows are never revived —
-- src/lib/supabase/companies.ts's grantCompanyApplication() always inserts
-- fresh, matching agv_application_access's own established "re-grant =
-- new row, never un-revoke" convention — so there is no UPDATE path that
-- turns a revoked scope row live again to also cover here).

create or replace function public.agv_grant_company_scope_to_managers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agv_application_access (application_id, profile_id)
  select new.application_id, p.id
  from public.agv_profiles p
  where p.company_id = new.company_id
    and p.is_company_manager = true
    and p.role = 'client'
  on conflict (application_id, profile_id) where revoked_at is null do nothing;
  return new;
end;
$$;

drop trigger if exists agv_company_applications_grant_managers on public.agv_company_applications;
create trigger agv_company_applications_grant_managers
  after insert on public.agv_company_applications
  for each row
  when (new.revoked_at is null)
  execute function public.agv_grant_company_scope_to_managers();

-- ————————————————————————————————————————————————————————————————
-- Trigger 2 — a profile becomes (or moves companies as) a manager: backfill
-- every application already in that company's live scope.
-- ————————————————————————————————————————————————————————————————
--
-- Closes the reverse-order gap Trigger 1 alone would leave open: a company
-- can already have live scope BEFORE someone is made its manager (the
-- ordinary case — an admin sets up a company's applications, then assigns
-- a manager later, or promotes a second manager on an already-scoped
-- company). Without this, that manager would see applications in their
-- company's scope with no personal access to any of them until an admin
-- happened to re-toggle each one.
--
-- WHEN guards this to only the two transitions that actually matter
-- (becoming a manager, or a manager's company changing) rather than firing
-- on every unrelated agv_profiles update (a display-name change, for
-- instance) — cheaper than a function-body check and keeps this trigger
-- silent for the vast majority of profile writes.

create or replace function public.agv_backfill_manager_company_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agv_application_access (application_id, profile_id)
  select ca.application_id, new.id
  from public.agv_company_applications ca
  where ca.company_id = new.company_id
    and ca.revoked_at is null
  on conflict (application_id, profile_id) where revoked_at is null do nothing;
  return new;
end;
$$;

drop trigger if exists agv_profiles_backfill_manager_scope on public.agv_profiles;
create trigger agv_profiles_backfill_manager_scope
  after update on public.agv_profiles
  for each row
  when (
    new.is_company_manager = true
    and new.role = 'client'
    and new.company_id is not null
    and (
      old.is_company_manager is distinct from new.is_company_manager
      or old.company_id is distinct from new.company_id
    )
  )
  execute function public.agv_backfill_manager_company_scope();
