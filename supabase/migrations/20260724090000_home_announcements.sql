-- Phase 18 — "AGV Home" hub: announcements table, plus the missing
-- agv_profiles staff-read-all policy the staff directory needs.
--
-- Table x role x operation matrix (see STATUS.md for the tested/verified
-- version once this lands):
--
--   agv_announcements | admin | SELECT ✓ INSERT ✓ UPDATE ✓ DELETE ✓
--   agv_announcements | staff | SELECT ✓ INSERT ✗ UPDATE ✗ DELETE ✗
--   agv_announcements | client| SELECT ✗ INSERT ✗ UPDATE ✗ DELETE ✗
--   agv_profiles (new)| staff | SELECT ✓ (all rows — directory only reads
--                                id/name/role; no write policy added, own-row
--                                update policy from 10a is unchanged)
--   agv_profiles      | client| unchanged (own row only)

create table if not exists public.agv_announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  created_by uuid not null references public.agv_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agv_announcements is
  'Admin-authored announcements shown on the AGV Home hub. Phase 18.';

drop trigger if exists agv_announcements_set_updated_at on public.agv_announcements;
create trigger agv_announcements_set_updated_at
  before update on public.agv_announcements
  for each row execute function public.agv_set_updated_at();

alter table public.agv_announcements enable row level security;

drop policy if exists "announcements — admin all" on public.agv_announcements;
create policy "announcements — admin all" on public.agv_announcements
  for all using (agv_is_admin()) with check (agv_is_admin());

drop policy if exists "announcements — staff read" on public.agv_announcements;
create policy "announcements — staff read" on public.agv_announcements
  for select using (agv_is_staff());

-- Staff directory needs every profile's name/role, not just the caller's own
-- row (the only read policy staff had before this). Client does NOT get this
-- policy — "client gets no Home hub at all" is a locked decision, and the
-- directory query additionally filters to role IN ('admin','staff') itself
-- rather than relying on this grant alone (RLS doesn't know "directory" is
-- staff-only in intent — see STATUS.md for why that filter is required even
-- with this policy in place).
drop policy if exists "profiles — staff read all" on public.agv_profiles;
create policy "profiles — staff read all" on public.agv_profiles
  for select using (agv_is_staff());
