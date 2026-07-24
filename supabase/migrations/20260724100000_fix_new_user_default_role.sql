-- Fix: agv_handle_new_user() still defaulted a new profile's role to 'user',
-- a value that hasn't been a valid role since 20260723090000_role_staff_client
-- renamed it to 'staff' and narrowed agv_profiles_role_check to
-- ('admin', 'staff', 'client'). That migration updated existing rows and the
-- constraint, but not this trigger function — so every signup that doesn't
-- explicitly pass a role in its metadata has been hitting a check-constraint
-- violation on the agv_profiles insert since 20260723090000 landed. Because
-- the trigger runs AFTER INSERT on auth.users, the violation aborts the
-- whole signup transaction: auth.signUp() would fail outright, not just
-- leave the profile row missing.
--
-- Found while building a public sign-up page (self-serve accounts need this
-- trigger's default to actually be valid) — not previously exercised because
-- every account so far was created by the seed scripts, which always pass
-- role explicitly.

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
    coalesce(new.raw_user_meta_data ->> 'role', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
