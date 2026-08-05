-- Task 1 (companies access model) — add the missing manager-facing SELECT
-- policy on agv_application_access. Without this, a manager's revoke never
-- actually revokes anything: the UPDATE reports success (204/0 error) but
-- silently matches zero rows.
--
-- Root cause, confirmed via EXPLAIN ANALYZE against a live fixture (real
-- manager, real teammate, real grant row) in the SQL editor, not inferred:
-- PostgreSQL requires an UPDATE (and DELETE) to satisfy a SELECT-visibility
-- check on the row BEING UPDATED, in addition to that command's own
-- USING/WITH CHECK policies — you have to be able to see a row to touch it.
-- The actual filter PostgreSQL applied to the revoke attempt was:
--
--   ( (agv_manager_company_id() IS NOT NULL)
--     AND agv_profile_in_manager_company(profile_id) )
--   OR agv_is_admin()                                        -- the UPDATE policy (20260805120000)
--   AND
--   ( agv_application_access.profile_id = <jwt sub> )
--   OR agv_is_admin()                                        -- "access — own read" (10b-1), the ONLY select policy
--
-- The manager's own condition in the first line is true (confirmed
-- independently via RPC, same session, immediately before AND after the
-- failed update — ruling out stale data or a rotated session). But the
-- second line — the table's only SELECT policy, "access — own read" —
-- only ever passes when the row's profile_id is the CALLER's own id. A
-- manager revoking a TEAMMATE's grant (profile_id = the teammate, not the
-- manager) fails that second line, so the row is invisible to them at the
-- SELECT layer PostgreSQL requires for UPDATE, and the update matches zero
-- rows with no error — a silent no-op, not a rejection.
--
-- This didn't show up on the grant/INSERT side (20260805100000 /
-- 20260805120000) because INSERT has no pre-existing row to check
-- visibility against — this requirement is specific to UPDATE/DELETE.
--
-- Fix: give a manager SELECT visibility on exactly the set of rows they're
-- already allowed to revoke — same condition as "access — manager revoke
-- within company" (20260805120000), reusing the same SECURITY DEFINER
-- helpers so this reads past agv_profiles' own RLS rather than recursing
-- into it (same reasoning as every other manager-facing check in this
-- task).

create policy "access — manager read within company"
  on public.agv_application_access
  for select
  using (
    agv_manager_company_id() is not null
    and agv_profile_in_manager_company(profile_id)
  );
