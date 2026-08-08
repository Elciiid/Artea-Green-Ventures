// In-app activity (tab 2 of the admin activity log). agv_audit_log already
// exists and is populated by triggers on agv_applications, agv_documents,
// agv_activity_entries, agv_application_access (20260722120000), and — as
// of 20260808110000 — agv_companies, agv_company_applications, and
// agv_profiles (company create/delete, roster add/remove, manager-status
// toggle, and, as a side effect of covering agv_profiles generally, name
// edits and role changes too). This really is UI-only, unlike the
// sign-in/sign-up tab.

import { getSupabaseClient } from "@/lib/supabase/client";

export type AuditLogEntry = {
  id: string;
  actor: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  row_pk: string | null;
  changes: unknown;
  at: string;
};

export async function fetchAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_audit_log")
    .select("id, actor, action, table_name, row_pk, changes, at")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditLogEntry[];
}
