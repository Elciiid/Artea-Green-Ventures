// Phase 10b-2 — real Supabase reads for applications, replacing the Zustand
// mock store for every view except /admin/people/access (still 10b-3; it keeps
// reading src/lib/applications.ts until the grant/revoke UI goes real too).
//
// No client-side visibility filtering happens in fetchApplications()/
// fetchApplicationByReference() themselves: RLS (Phase 10b-1) already
// restricts which rows a query can return, so both run the exact same query
// for admins and non-admins — the access boundary is enforced by Postgres,
// not this code. fetchPersonallyGrantedApplications() below is the one
// deliberate exception, added after review found a real gap in a
// company-manager's RLS-widened visibility — see its own doc comment.

import { getSupabaseClient } from "@/lib/supabase/client";
import { assertRowReturned } from "@/lib/supabase/assert-write";
import { fetchApplicationsForAccess } from "@/lib/supabase/access";
import { PIPELINE, type Application, type DocumentItem, type TimelineEntry, type Stage } from "@/lib/mock-data";

type ApplicationRow = {
  id: string;
  reference: string;
  title: string;
  service: string;
  sector: string;
  location: string;
  country: string;
  coords: string | null;
  stage: string;
  status_note: string | null;
  lead: string;
  client_name: string;
  hero: string | null;
  submitted_at: string;
};

type DocumentRow = {
  id: string;
  name: string;
  kind: string;
  size_label: string | null;
  status: string;
  uploaded_at: string | null;
  storage_path: string | null;
};

type ActivityRow = {
  occurred_at: string;
  actor: string;
  kind: string;
  body: string;
};

const APPLICATION_COLUMNS =
  "id, reference, title, service, sector, location, country, coords, stage, status_note, lead, client_name, hero, submitted_at";

// ilike treats %/_ as wildcards; references never legitimately contain them,
// so escape rather than let a stray wildcard in the URL match more than one
// row (which would surface as a generic error instead of the correct
// not-found/blocked state via .maybeSingle()'s "multiple rows" error).
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function toDocument(row: DocumentRow): DocumentItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    size: row.size_label ?? "—",
    status: row.status as DocumentItem["status"],
    uploaded: row.uploaded_at ? row.uploaded_at.slice(0, 10) : undefined,
    storagePath: row.storage_path ?? undefined,
  };
}

function toTimelineEntry(row: ActivityRow): TimelineEntry {
  return {
    at: row.occurred_at.slice(0, 10),
    actor: row.actor,
    kind: row.kind as TimelineEntry["kind"],
    text: row.body,
  };
}

function toApplication(
  row: ApplicationRow,
  documents: DocumentRow[],
  activity: ActivityRow[]
): Application {
  return {
    id: row.reference,
    title: row.title,
    service: row.service,
    sector: row.sector as Application["sector"],
    location: row.location,
    country: row.country as Application["country"],
    coords: row.coords ?? "",
    stage: row.stage as Stage,
    statusNote: row.status_note ?? undefined,
    lead: row.lead,
    clientName: row.client_name,
    hero: row.hero ?? "",
    submitted: row.submitted_at,
    documents: documents.map(toDocument),
    timeline: activity.map(toTimelineEntry),
  };
}

/**
 * Every application the signed-in account can see. Admins get every row;
 * staff and a plain client get only what RLS lets through via a live grant
 * in agv_application_access. Same query either way — Postgres does the
 * filtering (proven in Phase 10b-1).
 *
 * CAVEAT added by the My Team work (20260806100000_my_team_manager_read.sql):
 * a company-manager session also reads every application within their
 * company's SCOPE via an additional agv_applications policy — a ceiling My
 * Team's own checklist genuinely needs (it has to show titles/references for
 * applications nobody's been granted yet, so the manager can choose to grant
 * them). Because RLS policies are table-wide, not query-scoped, that same
 * widening applies to THIS function too when a manager calls it — so for a
 * manager, fetchApplications() can return applications they can read the
 * row for but hold no personal grant on, and agv_documents/
 * agv_activity_entries (unchanged, still gated on a personal grant only)
 * will render those as a fake "0 of 0 received", empty-timeline application
 * rather than an honest partial view. Any GENERAL list built on this
 * function (the /portal register, the client-manager Dashboard) must use
 * fetchPersonallyGrantedApplications() below for a manager instead — see its
 * own doc comment. My Team's checklist is the one legitimate caller that
 * wants the wider scope set, and it gets there through team.ts's
 * applicationsInScope(), not this function.
 */
export async function fetchApplications(): Promise<Application[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_applications")
    .select(APPLICATION_COLUMNS)
    .order("reference", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ApplicationRow[]).map((row) => toApplication(row, [], []));
}

type OwnGrantRow = { application_id: string };

/**
 * fetchApplications(), narrowed to applications the caller PERSONALLY holds
 * a live grant for — see fetchApplications()'s own doc comment for why this
 * differs from it for a company-manager session (and is identical to it,
 * a harmless no-op filter, for every other role). Reads own live grants from
 * agv_application_access — whose base "access — own read" RLS policy
 * (profile_id = auth.uid()) is untouched by the company-scope widening — so
 * this always reflects a genuine personal grant, never the wider
 * scope-readable set. The join back to a reference (Application.id is the
 * display reference, not agv_application_access's uuid FK) reuses
 * fetchApplicationsForAccess() from access.ts, the same uuid+reference+title
 * shape team.ts's applicationsInScope() already joins through client-side —
 * matching this codebase's established pattern rather than a PostgREST
 * embedded-resource select, which has no precedent elsewhere in this app.
 */
export async function fetchPersonallyGrantedApplications(profileId: string): Promise<Application[]> {
  const supabase = getSupabaseClient();
  const [applications, accessApplications, ownGrantRows] = await Promise.all([
    fetchApplications(),
    fetchApplicationsForAccess(),
    supabase
      .from("agv_application_access")
      .select("application_id")
      .eq("profile_id", profileId)
      .is("revoked_at", null),
  ]);
  if (ownGrantRows.error) throw ownGrantRows.error;

  const grantedIds = new Set((ownGrantRows.data as OwnGrantRow[] | null ?? []).map((r) => r.application_id));
  const referenceById = new Map(accessApplications.map((a) => [a.id, a.reference]));
  const grantedReferences = new Set(
    [...grantedIds].map((id) => referenceById.get(id)).filter((r): r is string => Boolean(r))
  );
  return applications.filter((a) => grantedReferences.has(a.id));
}

/**
 * Whether the caller personally holds a live grant for this application's
 * uuid — distinct from being able to read the agv_applications row at all,
 * which a company-manager can do more widely (see fetchApplications()'s doc
 * comment). Used by UserApplicationView to decide whether a manager opening
 * a scope-only, not-personally-granted application should see an honest
 * "you don't have personal access to this yet" state instead of the real
 * detail view, whose documents/activity would otherwise silently render as
 * a fake-empty application.
 */
export async function hasPersonalApplicationGrant(
  applicationId: string,
  profileId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_application_access")
    .select("id")
    .eq("application_id", applicationId)
    .eq("profile_id", profileId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * One application by its display reference (e.g. "AGV-2026-0142"), with its
 * documents and activity, or null if it doesn't exist OR the signed-in
 * account has no live grant for it. RLS makes those two cases
 * indistinguishable on purpose — a user can't tell "wrong reference" from
 * "not yours" for something they can't see.
 */
export async function fetchApplicationByReference(
  reference: string
): Promise<Application | null> {
  const supabase = getSupabaseClient();

  const { data: appRow, error: appError } = await supabase
    .from("agv_applications")
    .select(APPLICATION_COLUMNS)
    .ilike("reference", escapeLike(reference))
    .maybeSingle();
  if (appError) throw appError;
  if (!appRow) return null;
  const application = appRow as ApplicationRow;

  const [docsResult, activityResult] = await Promise.all([
    supabase
      .from("agv_documents")
      .select("id, name, kind, size_label, status, uploaded_at, storage_path")
      .eq("application_id", application.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("agv_activity_entries")
      .select("occurred_at, actor, kind, body")
      .eq("application_id", application.id)
      .order("occurred_at", { ascending: true }),
  ]);
  if (docsResult.error) throw docsResult.error;
  if (activityResult.error) throw activityResult.error;

  return toApplication(
    application,
    (docsResult.data ?? []) as DocumentRow[],
    (activityResult.data ?? []) as ActivityRow[]
  );
}

/**
 * Resolve a display reference to its real uuid. Writes need the uuid
 * (agv_activity_entries.application_id is a FK to it), but the Application
 * type only carries the reference — reads never needed the uuid, so it was
 * never threaded through. RLS still gates this the same as any other read:
 * an application this account can't see resolves to null here too.
 */
export async function findApplicationId(reference: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_applications")
    .select("id")
    .ilike("reference", escapeLike(reference))
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Change an application's stage and log the matching activity entry, same
 * pairing the old local-only shim did (a stage change with no timeline entry
 * would never show up in the UI, which reads the timeline, not app.stage's
 * own history). Not atomic — two sequential writes, not one transaction.
 * Accepted simplification for this phase; no RPC/transaction wrapper yet.
 */
export async function changeApplicationStage(
  reference: string,
  stage: Stage,
  actor: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const applicationId = await findApplicationId(reference);
  if (!applicationId) throw new Error(`${reference} not found or not accessible.`);

  const { data: updated, error: updateError } = await supabase
    .from("agv_applications")
    .update({ stage, status_note: null })
    .eq("id", applicationId)
    .select("id");
  if (updateError) throw updateError;
  assertRowReturned(updated, "The status change didn't save — you may not have permission to edit this application.");

  const label = PIPELINE.find((p) => p.id === stage)?.label ?? stage;
  const { error: activityError } = await supabase.from("agv_activity_entries").insert({
    application_id: applicationId,
    occurred_at: new Date().toISOString(),
    actor,
    kind: "status",
    body: `Status moved to ${label}.`,
  });
  if (activityError) throw activityError;
}

/** Add a comment entry to an application's activity timeline. */
export async function addActivityNote(reference: string, actor: string, text: string): Promise<void> {
  const supabase = getSupabaseClient();
  const applicationId = await findApplicationId(reference);
  if (!applicationId) throw new Error(`${reference} not found or not accessible.`);

  const { error } = await supabase.from("agv_activity_entries").insert({
    application_id: applicationId,
    occurred_at: new Date().toISOString(),
    actor,
    kind: "comment",
    body: text,
  });
  if (error) throw error;
}
