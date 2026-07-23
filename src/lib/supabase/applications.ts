// Phase 10b-2 — real Supabase reads for applications, replacing the Zustand
// mock store for every view except /admin/access (still 10b-3; it keeps
// reading src/lib/applications.ts until the grant/revoke UI goes real too).
//
// No client-side visibility filtering happens here: RLS (Phase 10b-1)
// already restricts which rows a query can return, so fetchApplications()
// and fetchApplicationByReference() run the exact same query for admins and
// non-admins — the access boundary is enforced by Postgres, not this code.

import { getSupabaseClient } from "@/lib/supabase/client";
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
 * everyone else gets only what RLS lets through via a live grant in
 * agv_application_access. Same query either way — Postgres does the
 * filtering (proven in Phase 10b-1).
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

  // UPDATE unlike INSERT doesn't throw on an RLS denial — a USING clause
  // that matches 0 rows just succeeds with an empty result, silently. Ask
  // for the row back and check it actually came back, rather than trusting
  // "no error" as proof of a real write.
  const { data: updated, error: updateError } = await supabase
    .from("agv_applications")
    .update({ stage, status_note: null })
    .eq("id", applicationId)
    .select("id");
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) {
    throw new Error("The status change didn't save — you may not have permission to edit this application.");
  }

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
