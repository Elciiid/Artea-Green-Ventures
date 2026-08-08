-- Audit-log coverage for the Companies feature's admin actions — the
-- long-flagged agv_profiles gap (see AdminHomeDashboard.tsx's and
-- auditLog.ts's own header comments: "no trigger writes agv_profiles
-- changes into this table today"), now made concrete: company create/
-- delete, roster add/remove, manager-status toggle, and company-scope
-- grant/revoke currently have no audit trail at all.
--
-- No new mechanism — this reuses agv_write_audit() (20260722120000)
-- exactly as already attached to agv_applications/agv_documents/
-- agv_activity_entries/agv_application_access: a single generic
-- SECURITY DEFINER function keyed off tg_table_name, attached via a plain
-- "after insert or update or delete ... for each row" trigger with no
-- per-table customisation. Three tables get that same trigger here:
--
--   agv_companies            — company create/delete
--   agv_company_applications — scope grant/revoke (lifecycle rows, same
--                               grant/revoke shape agv_application_access
--                               already uses)
--   agv_profiles             — roster add/remove (company_id changes),
--                               manager-status toggle (is_company_manager
--                               changes)
--
-- agv_profiles is the one worth calling out explicitly: this is a
-- blanket table-wide trigger, the same shape as every other one here, so
-- it also captures every OTHER column change on that table — display-name
-- edits (src/lib/supabase/profile.ts's updateOwnName) and, notably, role
-- changes via /api/admin/set-role. That second one is the older,
-- separately-flagged "role changes aren't audited" gap — this closes it
-- as a side effect of closing the company one, not via a second mechanism.
-- Deliberately not narrowed with a WHEN clause to just company_id/
-- is_company_manager: every other audited table in this app captures the
-- whole row on every change (agv_write_audit snapshots old/new via
-- to_jsonb, not a column allowlist), and agv_profiles has no columns
-- sensitive enough to withhold from an admin-only-readable log (no email,
-- no password — see the table's own migration) that the other four
-- audited tables don't already set the precedent for.

drop trigger if exists agv_audit_companies on public.agv_companies;
create trigger agv_audit_companies
  after insert or update or delete on public.agv_companies
  for each row execute function public.agv_write_audit();

drop trigger if exists agv_audit_company_applications on public.agv_company_applications;
create trigger agv_audit_company_applications
  after insert or update or delete on public.agv_company_applications
  for each row execute function public.agv_write_audit();

drop trigger if exists agv_audit_profiles on public.agv_profiles;
create trigger agv_audit_profiles
  after insert or update or delete on public.agv_profiles
  for each row execute function public.agv_write_audit();
