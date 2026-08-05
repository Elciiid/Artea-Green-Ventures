-- Companies access-control layer, Task 1 — schema, helper predicate, and RLS.
--
-- Adds a company tier between "admin" and "everyone else": a company has a
-- set of applications in scope (agv_company_applications, admin-managed,
-- lifecycle rows like agv_application_access — granted_at/revoked_at, never
-- deleted) and zero or more agv_profiles rows tagged with that company_id.
-- One of those profiles may additionally be flagged is_company_manager,
-- which lets them grant/revoke agv_application_access rows for their own
-- teammates, scoped to their own company's application set — see the two
-- new policies added to agv_application_access below.
--
-- company_id is nullable by design: unassigned is the default state for
-- every existing row and every new signup, not an error state. No backfill
-- needed; existing agv_profiles rows simply get company_id = null.
--
-- What this migration does NOT do (deliberately, per the task split):
--   • No client-manager-facing read policy on agv_companies /
--     agv_company_applications — a manager's own UI is a separate follow-up;
--     their write path (agv_application_access) is covered below via the
--     SECURITY DEFINER helper, not via a row-level read policy they'd need.
--   • No admin UI for assigning companies / toggling manager status — the
--     service-role API route this requires (src/app/api/admin/set-company)
--     ships in this task since it's the fix for an RLS gap identical to
--     set-role's; wiring it into an admin screen is a follow-up.

-- ————————————————————————————————————————————————————————————————
-- agv_companies
-- ————————————————————————————————————————————————————————————————

create table if not exists public.agv_companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.agv_profiles (id)
);

comment on table public.agv_companies is
  'Client companies. A profile may belong to one via agv_profiles.company_id. Task 1 (companies access model).';

-- ————————————————————————————————————————————————————————————————
-- agv_profiles — two new columns (company assignment + manager flag)
-- ————————————————————————————————————————————————————————————————

alter table public.agv_profiles
  add column if not exists company_id uuid references public.agv_companies (id),
  add column if not exists is_company_manager boolean not null default false;

comment on column public.agv_profiles.company_id is
  'The company this profile belongs to, if any. Null is the default/unassigned state, not an error.';
comment on column public.agv_profiles.is_company_manager is
  'Whether this profile may grant/revoke agv_application_access for teammates in its own company. Guarded against self-escalation by agv_prevent_self_role_escalation (see 20260805110000).';

-- ————————————————————————————————————————————————————————————————
-- agv_company_applications  (admin-managed scope: which applications a
-- company can see/grant into, as lifecycle rows like agv_application_access)
-- ————————————————————————————————————————————————————————————————

create table if not exists public.agv_company_applications (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.agv_companies (id) on delete cascade,
  application_id uuid not null references public.agv_applications (id) on delete cascade,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

comment on table public.agv_company_applications is
  'Which applications are in a company''s live scope, as grant/revoke lifecycle rows (never deleted). Task 1 (companies access model).';

create unique index if not exists agv_company_applications_live_uidx
  on public.agv_company_applications (company_id, application_id)
  where revoked_at is null;

-- ————————————————————————————————————————————————————————————————
-- Helper predicate (SECURITY DEFINER, same pattern as agv_is_admin() /
-- agv_has_app_access() in 20260722120000_agv_domain.sql).
--
-- Deliberately a single primitive that fails closed for every adversarial
-- case at once: a non-manager's own row has is_company_manager = false, so
-- the where clause excludes it and this returns null; a manager somehow
-- missing a company_id also gets null (defensive; shouldn't happen given
-- the flag is meaningless without an assigned company); and any policy
-- comparing "= agv_manager_company_id()" is false against null by normal
-- SQL null-comparison semantics, with no special-casing needed downstream.
-- ————————————————————————————————————————————————————————————————

create or replace function public.agv_manager_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.agv_profiles
  where id = auth.uid() and is_company_manager = true and company_id is not null;
$$;

-- ————————————————————————————————————————————————————————————————
-- Row Level Security
-- ————————————————————————————————————————————————————————————————

-- agv_companies: admin-only, same simple shape as agv_organizations'
-- "orgs — admin write" (no read-all-signed-in-users policy here, unlike
-- orgs, since companies are not global reference data every user needs).
alter table public.agv_companies enable row level security;
drop policy if exists "companies — admin all" on public.agv_companies;
create policy "companies — admin all" on public.agv_companies
  for all using (agv_is_admin()) with check (agv_is_admin());

-- agv_company_applications: admin-only. A manager's ceiling check reads
-- this table through agv_manager_company_id() + the policies below (both
-- SECURITY DEFINER paths), not via a row-level read policy of their own,
-- so no manager-facing policy is needed here.
alter table public.agv_company_applications enable row level security;
drop policy if exists "company applications — admin all" on public.agv_company_applications;
create policy "company applications — admin all" on public.agv_company_applications
  for all using (agv_is_admin()) with check (agv_is_admin());

-- agv_application_access — two ADDITIONAL policies, alongside the existing
-- "access — admin all" and "access — own read" (10b-1, untouched). Multiple
-- permissive policies for the same command combine with OR in Postgres RLS,
-- so these only ADD reach for managers; they never narrow what admins can
-- already do, and grant a regular (non-manager) client nothing, since
-- agv_manager_company_id() returns null for them and every exists/=
-- comparison against a null company id is false.

-- A manager may grant a live application-scope entry to a teammate in
-- their own company. Both conditions must hold: the target profile
-- belongs to the manager's company, and the application is within that
-- company's live scope.
drop policy if exists "access — manager grant within company scope" on public.agv_application_access;
create policy "access — manager grant within company scope"
  on public.agv_application_access
  for insert
  with check (
    agv_manager_company_id() is not null
    and exists (
      select 1 from public.agv_profiles target
      where target.id = agv_application_access.profile_id
        and target.company_id = agv_manager_company_id()
    )
    and exists (
      select 1 from public.agv_company_applications sca
      where sca.application_id = agv_application_access.application_id
        and sca.company_id = agv_manager_company_id()
        and sca.revoked_at is null
    )
  );

-- A manager may revoke (never delete) a live grant belonging to a
-- teammate in their own company — including one an admin originally
-- granted. Revoking only narrows access, so this does not need to
-- re-check company-application scope, only that the grant's own
-- profile is a same-company teammate.
drop policy if exists "access — manager revoke within company" on public.agv_application_access;
create policy "access — manager revoke within company"
  on public.agv_application_access
  for update
  using (
    agv_manager_company_id() is not null
    and exists (
      select 1 from public.agv_profiles target
      where target.id = agv_application_access.profile_id
        and target.company_id = agv_manager_company_id()
    )
  )
  with check (
    agv_manager_company_id() is not null
    and exists (
      select 1 from public.agv_profiles target
      where target.id = agv_application_access.profile_id
        and target.company_id = agv_manager_company_id()
    )
  );
