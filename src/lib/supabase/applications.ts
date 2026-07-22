// Phase 10b-2 — real Supabase reads for applications, replacing the Zustand
// mock store for every view except /admin/access (still 10b-3; it keeps
// reading src/lib/applications.ts until the grant/revoke UI goes real too).
//
// No client-side visibility filtering happens here: RLS (Phase 10b-1)
// already restricts which rows a query can return, so fetchApplications()
// and fetchApplicationByReference() run the exact same query for admins and
// non-admins — the access boundary is enforced by Postgres, not this code.

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Application, DocumentItem, TimelineEntry, Stage } from "@/lib/mock-data";

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
  name: string;
  kind: string;
  size_label: string | null;
  status: string;
  uploaded_at: string | null;
};

type ActivityRow = {
  occurred_at: string;
  actor: string;
  kind: string;
  body: string;
};

const APPLICATION_COLUMNS =
  "id, reference, title, service, sector, location, country, coords, stage, status_note, lead, client_name, hero, submitted_at";

function toDocument(row: DocumentRow): DocumentItem {
  return {
    name: row.name,
    kind: row.kind,
    size: row.size_label ?? "—",
    status: row.status as DocumentItem["status"],
    uploaded: row.uploaded_at ? row.uploaded_at.slice(0, 10) : undefined,
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
    .ilike("reference", reference)
    .maybeSingle();
  if (appError) throw appError;
  if (!appRow) return null;
  const application = appRow as ApplicationRow;

  const [docsResult, activityResult] = await Promise.all([
    supabase
      .from("agv_documents")
      .select("name, kind, size_label, status, uploaded_at")
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
