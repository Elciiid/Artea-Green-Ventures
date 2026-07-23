-- Phase 10a — agv_profiles
--
-- Per-user profile plus the three display preferences migrated from the
-- Phase 14a/9 localStorage store. Table naming: every table this project
-- creates in `public` carries an `agv_` prefix. `auth.users` is Supabase's
-- own table in the `auth` schema and is NOT renamed.
--
-- RLS note: the phase defers the RLS *policy* work (domain tables, delegation
-- rules) to Phase 10b. But a profiles table cannot ship either world-readable
-- (RLS off) or unreadable (RLS on, no policy). So this migration enables RLS
-- with the minimum needed for a profile to function — a person can read and
-- update ONLY their own row. Flagged in STATUS.md for confirmation; the
-- comprehensive RLS model still belongs to 10b.

create table if not exists public.agv_profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text not null,
  role            text not null default 'user' check (role in ('admin', 'user')),
  -- organization_id is carried from day one per the Phase 10 schema decisions,
  -- even though there's only one org today. No FK yet — agv_organizations
  -- arrives in Phase 10b, which will add the constraint. Default is a fixed
  -- placeholder AGV org id until then.
  organization_id uuid not null default '00000000-0000-0000-0000-0000000a6700',
  -- display preferences (migrated from localStorage; light default per Phase 16)
  text_size       text not null default 'default' check (text_size in ('default', 'large', 'larger')),
  motion          text not null default 'system'  check (motion in ('system', 'reduced', 'full')),
  theme           text not null default 'light'   check (theme in ('system', 'dark', 'light')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.agv_profiles is
  'Per-user profile and display preferences. Phase 10a.';

-- keep updated_at honest
create or replace function public.agv_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agv_profiles_set_updated_at on public.agv_profiles;
create trigger agv_profiles_set_updated_at
  before update on public.agv_profiles
  for each row execute function public.agv_set_updated_at();

-- Auto-create a profile row whenever an auth user is created. name/role come
-- from the user's metadata (set by the seed script / real onboarding).
create or replace function public.agv_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agv_profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists agv_on_auth_user_created on auth.users;
create trigger agv_on_auth_user_created
  after insert on auth.users
  for each row execute function public.agv_handle_new_user();

-- ——— minimal own-row RLS (see header note; full model is Phase 10b) ———
alter table public.agv_profiles enable row level security;

drop policy if exists "own profile — read" on public.agv_profiles;
create policy "own profile — read"
  on public.agv_profiles for select
  using (auth.uid() = id);

drop policy if exists "own profile — update" on public.agv_profiles;
create policy "own profile — update"
  on public.agv_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
