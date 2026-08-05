-- Task 1 (companies access model) — close the SECOND half of the task
-- reviewer's Critical finding on agv_application_access (the first half,
-- application_id/profile_id/granted_at tamper, was fixed in
-- 20260805140000). This migration extends that SAME trigger function
-- (create or replace — not a second trigger) rather than leaving the gap
-- half-closed.
--
-- The original finding named two mechanisms for a manager reaching an
-- out-of-scope live grant via UPDATE instead of the INSERT path
-- adversarial test (b) actually exercises:
--   1. retargeting application_id on a visible row — closed by 20260805140000.
--   2. "resurrecting" an old, now-out-of-scope grant by flipping
--      revoked_at from a timestamp back to null — STILL OPEN after
--      20260805140000, because that trigger deliberately excludes
--      revoked_at from its guarded-columns list (it has to — revoked_at
--      is the ONE column the legitimate revoke path is supposed to
--      write). Excluding the whole column also excluded the ONE
--      direction of that column's change that's illegitimate.
--
-- Concretely: a manager grants a teammate access to an in-scope
-- application. Later, an admin removes that application from the
-- company's scope (agv_company_applications gets a revoked_at of its
-- own). The manager's now-stale agv_application_access row is still
-- live (revoked_at is null) and still visible to them via
-- "access — manager read within company" (20260805130000) — nothing
-- required them to revoke it first. If the manager revokes it (sets
-- revoked_at to a timestamp) and then flips it back to null, they've
-- resurrected a live grant to an application no longer in their
-- company's scope, with no admin mistake as a precondition and no
-- re-check of company-application scope anywhere in that transition.
--
-- Per src/lib/supabase/access.ts's own header comment, this app's
-- established design is explicit about the correct direction already:
-- "revoking sets revoked_at rather than removing the row... and
-- re-granting after a revoke inserts a NEW row rather than reviving the
-- old one." A legitimate re-grant is always a fresh INSERT, which re-runs
-- the full company-scope check via "access — manager grant within
-- company scope" (20260805100000/20260805120000). Flipping revoked_at
-- back to null is never how this app intends re-granting to happen for
-- anyone but an admin — so the fix isn't to scope-check the un-revoke,
-- it's to block that transition outright for non-admins, matching how
-- re-granting already works everywhere else in this app.
--
-- Fix: one more guarded condition in the existing OR-chain —
-- old.revoked_at is not null and new.revoked_at is null (the un-revoke/
-- resurrection direction only). This does not touch the legitimate
-- revoke direction: when a live grant is revoked, old.revoked_at is
-- null, so this new clause never fires for that transition.

create or replace function public.agv_prevent_application_access_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.application_id is distinct from old.application_id
    or new.profile_id is distinct from old.profile_id
    or new.granted_at is distinct from old.granted_at
    or (old.revoked_at is not null and new.revoked_at is null)
  ) then
    if auth.uid() is not null and not public.agv_is_admin() then
      raise exception 'Only admins may change application_id, profile_id, or granted_at on an access grant, or un-revoke a revoked grant.';
    end if;
  end if;
  return new;
end;
$$;

-- The trigger itself (agv_application_access_prevent_tamper, before update
-- on agv_application_access) is unchanged — it already points at this
-- function name, so create or replace above is sufficient.
