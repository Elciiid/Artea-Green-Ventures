// Companies admin data layer (Task 2 — the admin-facing UI for Task 1's
// agv_companies / agv_company_applications / agv_profiles.company_id schema).
//
// Write boundary, per the Task 2 brief: agv_companies and
// agv_company_applications go straight through the anon client + RLS — both
// tables carry a simple "<table> — admin all" policy (Task 1), so a
// signed-in admin's own anon-bound client can write them directly, exactly
// like agv_application_access's admin writes in access.ts. agv_profiles is
// different: it has no RLS policy letting an admin write another person's
// row, only "own profile — update" — so every write here that touches
// someone ELSE's company_id/is_company_manager goes through the existing
// service-role route (/api/admin/set-company) via setCompanyAssignment()
// below, never a direct .update() against agv_profiles. That route already
// verifies the caller is admin itself before writing.

import { getSupabaseClient } from "@/lib/supabase/client";
import { assertRowReturned } from "@/lib/supabase/assert-write";

export type Company = {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
};

/** A client profile, as seen by the companies admin page. `company_id` is
 * null for an unassigned client. Every query here is pre-filtered to
 * role = 'client' — staff/admin are out of scope for company rosters (see
 * Task 1 report §9: nothing stops a staff profile from being assigned a
 * company_id at the schema level, but agv_profile_in_manager_company()'s
 * role = 'client' defense-in-depth filter exists specifically because this
 * UI would otherwise be the thing that makes a staff-in-a-company
 * misconfiguration reachable — so this UI simply never offers staff as a
 * roster candidate in the first place). */
export type ClientProfile = {
  id: string;
  name: string;
  company_id: string | null;
  is_company_manager: boolean;
};

export type CompanyApplicationGrant = {
  id: string;
  application_id: string;
};

/** Every company, for the list page and for the reassignment-confirm
 * dialog's "currently belongs to <name>" copy. */
export async function fetchCompanies(): Promise<Company[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_companies")
    .select("id, name, created_at, created_by")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function fetchCompany(companyId: string): Promise<Company | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_companies")
    .select("id, name, created_at, created_by")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Company | null;
}

/** Name only, per the brief — no clients or scope until assigned. `createdBy`
 * is the current admin's own profile id (nullable FK, no default), purely
 * for an audit trail; the "admin all" RLS policy on agv_companies doesn't
 * require it to be any particular value. */
export async function createCompany(name: string, createdBy: string | null): Promise<Company> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_companies")
    .insert({ name, created_by: createdBy })
    .select("id, name, created_at, created_by")
    .single();
  if (error) throw error;
  return data as Company;
}

/** Deletes a company outright — a real, irreversible action the reference's
 * mockup treats as free (its own local-state Delete button just filters the
 * array). Deliberately does NOT try to clear roster members' company_id
 * itself first: agv_profiles.company_id -> agv_companies has no ON DELETE
 * clause (confirmed in 20260805100000_agv_companies.sql, unlike
 * agv_company_applications's CASCADE), so Postgres itself safely rejects
 * deleting a company that still has roster members with a foreign-key
 * violation, rather than this needing to orchestrate a two-step clear-then-
 * delete that could partially fail. The caller surfaces that error as
 * "remove the roster first" rather than a raw Postgres error string. */
export async function deleteCompany(companyId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("agv_companies").delete().eq("id", companyId);
  if (error) throw error;
}

/** Every client profile in the system, assigned or not. One query serves
 * three call sites: the company list's roster counts, the unassigned-clients
 * section, and a company detail page's roster + add-to-roster candidate
 * pool — all three just filter/group this same array client-side, matching
 * AccessMatrix's "fetch everything once, filter/paginate in the UI" pattern. */
export async function fetchClientProfiles(): Promise<ClientProfile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_profiles")
    .select("id, name, company_id, is_company_manager")
    .eq("role", "client")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClientProfile[];
}

/**
 * Assigns and/or toggles manager status for ANOTHER profile — always via the
 * service-role route, never a direct client write against agv_profiles (Task
 * 1's RLS has no admin-write policy for someone else's row there; the
 * trigger would also reject a direct attempt, correctly). Pass `companyId:
 * null` to remove a client from a company's roster.
 */
export async function setCompanyAssignment(
  profileId: string,
  update: { companyId?: string | null; isCompanyManager?: boolean }
): Promise<void> {
  const res = await fetch("/api/admin/set-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileId,
      companyId: update.companyId,
      isCompanyManager: update.isCompanyManager,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? `Couldn't update that profile (${res.status}).`);
  }
}

/** Every currently-live (non-revoked) application scope entry for a company. */
export async function fetchCompanyApplicationGrants(
  companyId: string
): Promise<CompanyApplicationGrant[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_company_applications")
    .select("id, application_id")
    .eq("company_id", companyId)
    .is("revoked_at", null);
  if (error) throw error;
  return (data ?? []) as CompanyApplicationGrant[];
}

/** Add an application to a company's scope. Fails if a live grant already
 * exists (the partial unique index from Task 1's migration). */
export async function grantCompanyApplication(
  companyId: string,
  applicationId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("agv_company_applications")
    .insert({ company_id: companyId, application_id: applicationId });
  if (error) throw error;
}

/** Revoke a company's live scope entry by its own id — sets revoked_at,
 * never deletes the row (same lifecycle-row convention as
 * agv_application_access; see access.ts). */
export async function revokeCompanyApplication(grantId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_company_applications")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .select("id");
  if (error) throw error;
  assertRowReturned(data, "Couldn't revoke that application — you may not have permission.");
}
