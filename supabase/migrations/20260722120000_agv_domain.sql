-- Phase 10b-1 — Domain schema, RLS, and the append-only audit log.
--
-- This is the slice where the application / document / activity / access data
-- stops being Zustand + mock and becomes real, RLS-protected tables. Naming:
-- every table this project creates in `public` carries an `agv_` prefix.
--
-- What this migration does NOT do (deliberately, per the phase split):
--   • No delegation columns (granted_by, scope) on the access table — 12+11.
--   • No audit-browsing UI — that's Phase 13; this only creates the log + triggers.
--   • No verification_level enforcement — 12+11.
--   • No Storage buckets/policies — that's slice 10b-3 (this only holds document
--     metadata; storage_path stays null until a real file is attached).
--
-- The single AGV org row is inserted here (not in the seed) because existing
-- agv_profiles rows already default organization_id to the placeholder id, and
-- the FK added below must have that row to point at.

-- (Helper predicates agv_is_admin() / agv_has_app_access() are defined further
-- down, just before the RLS section — they reference tables created below, and
-- Postgres validates SQL function bodies at CREATE time.)

-- ————————————————————————————————————————————————————————————————
-- agv_organizations  (+ finish the organization_id FK deferred in 10a)
-- ————————————————————————————————————————————————————————————————

create table if not exists public.agv_organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agv_organizations is
  'Tenant organizations. Single-LGU tenancy for now; a real table, not a placeholder. Phase 10b.';

-- The one org today, using the same fixed id agv_profiles.organization_id
-- already defaults to, so the FK below is satisfied for existing rows.
insert into public.agv_organizations (id, name)
values ('00000000-0000-0000-0000-0000000a6700', 'Artea Green Ventures')
on conflict (id) do nothing;

-- Finish the FK 10a deliberately left off.
alter table public.agv_profiles drop constraint if exists agv_profiles_organization_id_fkey;
alter table public.agv_profiles
  add constraint agv_profiles_organization_id_fkey
  foreign key (organization_id) references public.agv_organizations (id);

-- ————————————————————————————————————————————————————————————————
-- agv_applications
-- ————————————————————————————————————————————————————————————————

create table if not exists public.agv_applications (
  id              uuid primary key default gen_random_uuid(),
  -- The human-readable case number (AGV-2026-0142). Displayed as the register's
  -- leading column since Phase 16; it becomes THIS field, not the route param.
  reference       text not null unique,
  title           text not null,
  service         text not null,
  sector          text not null check (sector in ('Transportation', 'Social Infrastructure')),
  location        text not null,
  country         text not null check (country in ('AU', 'PH')),
  coords          text,
  stage           text not null check (stage in ('submitted', 'under-review', 'site-visit', 'report-issued', 'closed')),
  status_note     text,
  lead            text not null,
  client_name     text not null,
  hero            text,
  submitted_at    date not null,
  organization_id uuid not null default '00000000-0000-0000-0000-0000000a6700'
                    references public.agv_organizations (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.agv_applications is
  'Environmental compliance applications. Migrated from mock-data.ts. Phase 10b.';

-- ————————————————————————————————————————————————————————————————
-- agv_documents  (metadata now; real Storage wiring is slice 10b-3)
-- ————————————————————————————————————————————————————————————————

create table if not exists public.agv_documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.agv_applications (id) on delete cascade,
  name           text not null,
  kind           text not null,
  -- Object path inside the Storage bucket; null until a real file is attached.
  storage_path   text,
  -- Human size string as displayed in Phase 16 ("14.2 MB", "—"); a real upload
  -- (10b-3) formats its byte count into this same field. Keeps the display
  -- identical for migrated rows and avoids a lossy MB→bytes round-trip.
  size_label     text,
  status         text not null check (status in ('received', 'pending')),
  uploaded_by    text,
  uploaded_at    timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.agv_documents is
  'Document metadata per application. Files land in Storage in slice 10b-3. Phase 10b.';

-- ————————————————————————————————————————————————————————————————
-- agv_activity_entries  (timestamptz, not the date-only mock strings)
-- ————————————————————————————————————————————————————————————————

create table if not exists public.agv_activity_entries (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.agv_applications (id) on delete cascade,
  occurred_at    timestamptz not null,
  actor          text not null,
  kind           text not null check (kind in ('status', 'comment', 'document', 'system')),
  body           text not null,
  created_at     timestamptz not null default now()
);

comment on table public.agv_activity_entries is
  'Per-application timeline. Phase 10b.';

-- ————————————————————————————————————————————————————————————————
-- agv_application_access  (replaces visibleApplicationIds; lifecycle records)
-- ————————————————————————————————————————————————————————————————
--
-- Built as lifecycle records — a grant is REVOKED (revoked_at set), never
-- deleted — so Phase 12+11 delegation is an enrichment of this table, not a
-- migration away from something simpler. A partial unique index enforces at
-- most one LIVE grant per (application, profile).

create table if not exists public.agv_application_access (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.agv_applications (id) on delete cascade,
  profile_id     uuid not null references public.agv_profiles (id) on delete cascade,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

comment on table public.agv_application_access is
  'Who may see which application, as grant/revoke lifecycle rows (never deleted). Phase 10b.';

create unique index if not exists agv_application_access_live_uidx
  on public.agv_application_access (application_id, profile_id)
  where revoked_at is null;

-- ————————————————————————————————————————————————————————————————
-- agv_audit_log  (written by triggers only; genuinely append-only)
-- ————————————————————————————————————————————————————————————————

create table if not exists public.agv_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid,               -- auth.uid() at write time; null for seed/system
  action     text not null,      -- INSERT | UPDATE | DELETE
  table_name text not null,
  row_pk     uuid,
  changes    jsonb not null,
  at         timestamptz not null default now()
);

comment on table public.agv_audit_log is
  'Append-only change log, written by triggers. Browsing UI is Phase 13. Phase 10b.';

-- The trigger runs as its owner (SECURITY DEFINER), so it can write to the log
-- even though the app roles have no INSERT privilege / policy on it.
create or replace function public.agv_write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_pk  uuid;
  v_changes jsonb;
begin
  if (tg_op = 'DELETE') then
    v_row_pk  := old.id;
    v_changes := jsonb_build_object('old', to_jsonb(old));
  elsif (tg_op = 'UPDATE') then
    v_row_pk  := new.id;
    v_changes := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else -- INSERT
    v_row_pk  := new.id;
    v_changes := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into public.agv_audit_log (actor, action, table_name, row_pk, changes)
  values (auth.uid(), tg_op, tg_table_name, v_row_pk, v_changes);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$$;

-- Attach to the content + access-control tables (the security-relevant ones).
drop trigger if exists agv_audit_applications on public.agv_applications;
create trigger agv_audit_applications
  after insert or update or delete on public.agv_applications
  for each row execute function public.agv_write_audit();

drop trigger if exists agv_audit_documents on public.agv_documents;
create trigger agv_audit_documents
  after insert or update or delete on public.agv_documents
  for each row execute function public.agv_write_audit();

drop trigger if exists agv_audit_activity on public.agv_activity_entries;
create trigger agv_audit_activity
  after insert or update or delete on public.agv_activity_entries
  for each row execute function public.agv_write_audit();

drop trigger if exists agv_audit_access on public.agv_application_access;
create trigger agv_audit_access
  after insert or update or delete on public.agv_application_access
  for each row execute function public.agv_write_audit();

-- keep updated_at honest on the two tables that have it (reuses the 10a fn)
drop trigger if exists agv_organizations_set_updated_at on public.agv_organizations;
create trigger agv_organizations_set_updated_at
  before update on public.agv_organizations
  for each row execute function public.agv_set_updated_at();

drop trigger if exists agv_applications_set_updated_at on public.agv_applications;
create trigger agv_applications_set_updated_at
  before update on public.agv_applications
  for each row execute function public.agv_set_updated_at();

-- ————————————————————————————————————————————————————————————————
-- Helper predicates (SECURITY DEFINER so they read past RLS without recursion).
-- Defined here, after the tables they read exist.
-- ————————————————————————————————————————————————————————————————

-- Is the current user an admin? Reads the caller's own profile role. Definer
-- so an admin-read policy ON agv_profiles can call it without recursing into
-- that same table's RLS.
create or replace function public.agv_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Does the current user hold a LIVE (non-revoked) grant for this application?
-- Definer so it can read agv_application_access regardless of that table's RLS.
create or replace function public.agv_has_app_access(app uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_application_access
    where application_id = app
      and profile_id = auth.uid()
      and revoked_at is null
  );
$$;

-- ————————————————————————————————————————————————————————————————
-- Row Level Security
--   admin  → full access to everything (agv_is_admin())
--   user   → only applications/documents/activity reachable via a LIVE grant
-- ————————————————————————————————————————————————————————————————

-- agv_organizations: readable by any signed-in user; only admins write.
alter table public.agv_organizations enable row level security;
drop policy if exists "orgs — read" on public.agv_organizations;
create policy "orgs — read" on public.agv_organizations
  for select using (auth.uid() is not null);
drop policy if exists "orgs — admin write" on public.agv_organizations;
create policy "orgs — admin write" on public.agv_organizations
  for all using (agv_is_admin()) with check (agv_is_admin());

-- agv_profiles: 10a's own-row policies stay; ADD admin read so the access UI
-- (slice 10b-3) can list users. (Own-row read/update were created in 10a.)
drop policy if exists "profiles — admin read" on public.agv_profiles;
create policy "profiles — admin read" on public.agv_profiles
  for select using (agv_is_admin());

-- agv_applications
alter table public.agv_applications enable row level security;
drop policy if exists "applications — admin all" on public.agv_applications;
create policy "applications — admin all" on public.agv_applications
  for all using (agv_is_admin()) with check (agv_is_admin());
drop policy if exists "applications — user read granted" on public.agv_applications;
create policy "applications — user read granted" on public.agv_applications
  for select using (agv_has_app_access(id));

-- agv_documents
alter table public.agv_documents enable row level security;
drop policy if exists "documents — admin all" on public.agv_documents;
create policy "documents — admin all" on public.agv_documents
  for all using (agv_is_admin()) with check (agv_is_admin());
drop policy if exists "documents — user read granted" on public.agv_documents;
create policy "documents — user read granted" on public.agv_documents
  for select using (agv_has_app_access(application_id));

-- agv_activity_entries
alter table public.agv_activity_entries enable row level security;
drop policy if exists "activity — admin all" on public.agv_activity_entries;
create policy "activity — admin all" on public.agv_activity_entries
  for all using (agv_is_admin()) with check (agv_is_admin());
drop policy if exists "activity — user read granted" on public.agv_activity_entries;
create policy "activity — user read granted" on public.agv_activity_entries
  for select using (agv_has_app_access(application_id));

-- agv_application_access: admins manage; a user may read only their own grants.
alter table public.agv_application_access enable row level security;
drop policy if exists "access — admin all" on public.agv_application_access;
create policy "access — admin all" on public.agv_application_access
  for all using (agv_is_admin()) with check (agv_is_admin());
drop policy if exists "access — own read" on public.agv_application_access;
create policy "access — own read" on public.agv_application_access
  for select using (profile_id = auth.uid());

-- agv_audit_log: admins may read; NO app-role writes. Combined with the REVOKE
-- below, it's append-only from the application's side (the definer trigger is
-- the only writer).
alter table public.agv_audit_log enable row level security;
drop policy if exists "audit — admin read" on public.agv_audit_log;
create policy "audit — admin read" on public.agv_audit_log
  for select using (agv_is_admin());

revoke update, delete on public.agv_audit_log from authenticated, anon;
