// Role-assignment reads/writes for the admin-only picker (src/components/admin/RoleAssignment.tsx).
//
// Reading every profile is fine straight from the browser — "profiles — admin
// read" (10b-1) already lets an admin SELECT every row. Writing a role is not:
// agv_profiles only has an own-row UPDATE policy, so an admin's own
// anon-bound client can't touch someone else's role at all via RLS, trigger
// aside. setProfileRole() goes through a service-role API route instead
// (src/app/api/admin/set-role/route.ts) rather than adding a third
// column-scoped policy to a table that's already had two column-restriction
// gaps found on it.

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/session";

export type ProfileForRoleAssignment = {
  id: string;
  name: string;
  role: Role;
};

export async function fetchAllProfiles(): Promise<ProfileForRoleAssignment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_profiles")
    .select("id, name, role")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProfileForRoleAssignment[];
}

export async function setProfileRole(profileId: string, role: Role): Promise<void> {
  const res = await fetch("/api/admin/set-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? `Couldn't change role (${res.status}).`);
  }
}
