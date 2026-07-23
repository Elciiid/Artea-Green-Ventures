// Phase 18 — data layer for the AGV Home hub: announcements and the staff
// directory. Client never calls any of this (no route reaches it — see
// AppShell's expect={["admin","staff"]} guard on every /home/* page — and
// RLS backs that up independently for announcements).

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/session";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  createdByName: string;
  createdAt: string;
};

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  creator: { name: string } | null;
};

/** Latest announcements, newest first. Pass `limit` for the Home feed. */
export async function fetchAnnouncements(limit?: number): Promise<Announcement[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("agv_announcements")
    .select("id, title, body, created_at, creator:agv_profiles!created_by(name)")
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as AnnouncementRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    createdByName: row.creator?.name ?? "Unknown",
  }));
}

/**
 * Admin-only write, enforced by RLS ("announcements — admin all"). INSERT
 * throws on a failing RLS check (unlike UPDATE), so no post-write row check
 * is needed here — see assertRowReturned's doc comment for why UPDATEs
 * elsewhere in this directory do need one.
 */
export async function createAnnouncement(title: string, body: string, actorId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("agv_announcements")
    .insert({ title, body, created_by: actorId });
  if (error) throw error;
}

export type DirectoryEntry = { id: string; name: string; role: Role };

/**
 * Admin + staff only, by explicit filter — the "profiles — staff read all"
 * RLS policy makes every profile row (including client) readable to staff,
 * since RLS has no concept of "this query is for a staff directory." The
 * role filter here is what keeps client accounts out of what's supposed to
 * read as an internal directory; it is not itself a security boundary
 * (client's own RLS read access is unchanged and unaffected either way).
 */
export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_profiles")
    .select("id, name, role")
    .in("role", ["admin", "staff"])
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DirectoryEntry[];
}
