-- Phase 10b-3a — Role model change: user → staff rename, add the client
-- role, visible_to_client filtering on activity entries, and the RLS this
-- all depends on. Everything in 10b-3 (real writes, three-role access UI,
-- Storage) builds on this.
--
-- "user" always meant AGV staff, never a client — this rename resolves that
-- ambiguity rather than introducing a new concept. client is a genuinely new
-- role: read-only always, even on applications it's granted to, filtered
-- further by visible_to_client on activity entries.

-- ————————————————————————————————————————————————————————————————
-- Role rename (data) + widened constraint (schema)
-- ————————————————————————————————————————————————————————————————

update public.agv_profiles set role = 'staff' where role = 'user';

alter table public.agv_profiles drop constraint if exists agv_profiles_role_check;
alter table public.agv_profiles
  add constraint agv_profiles_role_check check (role in ('admin', 'staff', 'client'));

-- ————————————————————————————————————————————————————————————————
-- visible_to_client on activity entries
-- ————————————————————————————————————————————————————————————————

alter table public.agv_activity_entries
  add column if not exists visible_to_client boolean not null default false;

comment on column public.agv_activity_entries.visible_to_client is
  'Whether a client-role reader may see this entry. Defaults false so every existing/system-generated entry stays staff+admin-only unless explicitly marked visible. Phase 10b-3a.';

-- ————————————————————————————————————————————————————————————————
-- Role helper predicates (SECURITY DEFINER, same shape as agv_is_admin())
-- ————————————————————————————————————————————————————————————————

create or replace function public.agv_is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_profiles
    where id = auth.uid() and role = 'staff'
  );
$$;

create or replace function public.agv_is_client()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_profiles
    where id = auth.uid() and role = 'client'
  );
$$;

-- ————————————————————————————————————————————————————————————————
-- agv_applications: staff gets real write rights via a live grant.
-- client is deliberately excluded here — no using()/with check() clause
-- ever evaluates true for a client role, so client has no path to UPDATE
-- regardless of grants. Row-level only in this slice — the application
-- layer (10b-3b) is what constrains which columns actually get sent;
-- see the plan's Global Constraints for why that's an accepted scope cut.
-- ————————————————————————————————————————————————————————————————

drop policy if exists "applications — staff write granted" on public.agv_applications;
create policy "applications — staff write granted" on public.agv_applications
  for update using (agv_is_staff() and agv_has_app_access(id))
             with check (agv_is_staff() and agv_has_app_access(id));

-- ————————————————————————————————————————————————————————————————
-- agv_activity_entries: staff can add entries on a granted application
-- (add-note); the old blanket "user read granted" policy is replaced with
-- one that additionally filters client reads to visible_to_client = true.
-- Staff reads are unaffected by visible_to_client — it's a client-only cut.
-- ————————————————————————————————————————————————————————————————

drop policy if exists "activity — staff write granted" on public.agv_activity_entries;
create policy "activity — staff write granted" on public.agv_activity_entries
  for insert with check (agv_is_staff() and agv_has_app_access(application_id));

drop policy if exists "activity — user read granted" on public.agv_activity_entries;
drop policy if exists "activity — read granted" on public.agv_activity_entries;
create policy "activity — read granted" on public.agv_activity_entries
  for select using (
    agv_has_app_access(application_id)
    and (agv_is_staff() or (agv_is_client() and visible_to_client))
  );

-- agv_documents and the agv_applications SELECT policy are already
-- role-agnostic via agv_has_app_access() — staff and client both continue
-- to read through them unchanged. Only activity reads split by role here.
