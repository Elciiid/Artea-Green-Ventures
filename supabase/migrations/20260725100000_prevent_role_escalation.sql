-- Phase 10b-3e (unplanned) — Close a live privilege-escalation hole in
-- agv_profiles's own-row UPDATE policy.
--
-- "own profile — update" (10a) only checks auth.uid() = id, not which
-- columns change — so any signed-in user, including a self-registered
-- signup with zero admin approval, could PATCH their own role straight to
-- 'admin' from the browser and get full RLS clearance across every table
-- that gates on agv_is_admin(). Found while reviewing OAuth's role
-- assignment (an OAuth-created account has even less friction than the
-- domain-gated signup route to reach this hole), but the hole itself
-- predates OAuth entirely and applies to every account today.
--
-- Fix: a BEFORE UPDATE trigger that rejects any change to role or
-- organization_id unless the actor is already an admin (agv_is_admin())
-- or is running with no JWT subject at all (auth.uid() is null), which is
-- how the service-role key behaves — so legitimate server-side grants
-- (the admin-access UI, the upcoming OAuth callback's role assignment,
-- seed scripts) still work unimpeded.

create or replace function public.agv_prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id) then
    if auth.uid() is not null and not public.agv_is_admin() then
      raise exception 'Only admins may change role or organization_id.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agv_profiles_prevent_role_escalation on public.agv_profiles;
create trigger agv_profiles_prevent_role_escalation
  before update on public.agv_profiles
  for each row execute function public.agv_prevent_self_role_escalation();
