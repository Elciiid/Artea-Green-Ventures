// Self-service profile edits for the signed-in account's own agv_profiles
// row — currently just the display name. Goes straight through the anon
// client, not a service-role route: "own profile — update" (10a) already
// lets a person UPDATE their own row via RLS (auth.uid() = id), and the
// self-escalation guard added since (agv_prevent_self_role_escalation,
// 20260725100000 + 20260805110000) only rejects a change to role/
// organization_id/company_id/is_company_manager — name was never covered by
// that trigger, so a direct client write is both sufficient and safe.

import { getSupabaseClient } from "@/lib/supabase/client";

export async function updateOwnName(id: string, name: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("agv_profiles").update({ name }).eq("id", id);
  if (error) throw error;
}
