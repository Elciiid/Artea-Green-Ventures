// Phase 10b-3c — real grant/revoke against agv_application_access, replacing
// the instant-toggle mock checkbox matrix. Grants are lifecycle records
// (granted_at + nullable revoked_at, never deleted) per the 10b-1 schema —
// revoking sets revoked_at rather than removing the row, and re-granting
// after a revoke inserts a new row rather than reviving the old one.

import { getSupabaseClient } from "@/lib/supabase/client";
import { assertRowReturned } from "@/lib/supabase/assert-write";
import type { Role } from "@/lib/session";

export type GrantableProfile = {
  id: string;
  name: string;
  role: Extract<Role, "staff" | "client">;
};

export type AccessApplication = {
  id: string;
  reference: string;
  title: string;
};

export type LiveGrant = {
  id: string;
  application_id: string;
  profile_id: string;
};

/** Every profile an admin may grant access to — staff and client, never admin. */
export async function fetchGrantableProfiles(): Promise<GrantableProfile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_profiles")
    .select("id, name, role")
    .in("role", ["staff", "client"])
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GrantableProfile[];
}

/**
 * Applications with their real uuid, not just the display reference — the
 * grant/revoke functions below need the uuid (agv_application_access's FK),
 * which the mapped Application type (src/lib/supabase/applications.ts)
 * doesn't carry.
 */
export async function fetchApplicationsForAccess(): Promise<AccessApplication[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_applications")
    .select("id, reference, title")
    .order("reference", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AccessApplication[];
}

/** Every currently-live (non-revoked) grant, across every profile and application. */
export async function fetchLiveGrants(): Promise<LiveGrant[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_application_access")
    .select("id, application_id, profile_id")
    .is("revoked_at", null);
  if (error) throw error;
  return (data ?? []) as LiveGrant[];
}

/** Grant a profile access to an application. Fails if a live grant already exists (partial unique index, 10b-1). */
export async function grantAccess(applicationId: string, profileId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("agv_application_access")
    .insert({ application_id: applicationId, profile_id: profileId });
  if (error) throw error;
}

/** Revoke a live grant by its own id — sets revoked_at, never deletes the row. */
export async function revokeAccess(grantId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_application_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .select("id");
  if (error) throw error;
  assertRowReturned(data, "Couldn't revoke access — you may not have permission.");
}
