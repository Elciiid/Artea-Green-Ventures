-- Security fix: agv_handle_new_user() (SECURITY DEFINER, AFTER INSERT on
-- auth.users) has been trusting new.raw_user_meta_data ->> 'role' since it
-- was introduced. That column is NOT a trusted, server-only channel — it's
-- exactly what a caller passes as `options: { data: {...} }` to Supabase
-- Auth's signUp() (or as `user_metadata` to admin.createUser()), and
-- Supabase Auth is directly reachable by anyone holding the public anon key
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY, public by design), completely bypassing
-- this app's own /api/auth/signup route. Confirmed live (2026-08-05,
-- pre-fix): a raw supabase.auth.signUp() call with
-- options.data.role = 'admin' produced an agv_profiles row with
-- role = 'admin' — full unconditional access, no approval, no review.
--
-- Fix: this trigger must never read role from metadata again. Every new
-- profile is now inserted with the safest possible default — 'client',
-- this app's least-privileged role. Per PRODUCT.md's Capabilities and
-- Constraints, client is "read-only, always, even on granted applications,
-- and only sees activity marked client-visible" — i.e. zero access by
-- design until an admin explicitly grants it, exactly the same reasoning
-- signup/route.ts already uses ("Clients start with zero application
-- access regardless... the checkpoint that matters is an admin's manual
-- grant"). Landing every brand-new account there first is safe by
-- construction: worst case is a legitimate staff/admin signup briefly
-- shows as client until the explicit follow-up write below lands (same
-- request, milliseconds later — not a separate approval step for the
-- legitimate paths, which now perform that write themselves).
--
-- name is left reading from metadata — it's cosmetic display text, not an
-- access-control decision, so there's nothing to exploit there.
--
-- Every legitimate path that used to rely on this trigger picking up role
-- from metadata now does an explicit, privileged UPDATE immediately after
-- creating the account, via the service-role client (bypasses RLS and the
-- agv_prevent_self_role_escalation trigger, which already special-cases a
-- null auth.uid() — see 20260725100000):
--   - src/app/api/auth/signup/route.ts (both the staff and client branches)
--   - supabase/seed-users.mjs (the create-new-account branch; the
--     update-existing-account branch already did this)
-- src/app/auth/callback/route.ts (OAuth) already did its role assignment
-- as an explicit service-role UPDATE after the trigger ran, independent of
-- metadata — no change needed there, verified by reading it.

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
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
