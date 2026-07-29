// In-app activity (tab 2 of the admin activity log). agv_audit_log already
// exists and is populated by triggers on agv_applications, agv_documents,
// agv_activity_entries, and agv_application_access (20260722120000) — this
// really is UI-only, unlike the sign-in/sign-up tab. Note: it does NOT cover
// agv_profiles changes (name edits, role changes) or MFA enrollment — no
// trigger writes those into this table today, so a "name changes, MFA
// changes" tab isn't actually backed yet. This tab shows what the table
// genuinely has: application/document/access-grant activity.

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
