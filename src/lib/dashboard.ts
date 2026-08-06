// Pure computations shared by the four Dashboard variants
// (src/components/home/*HomeDashboard.tsx). Every function here takes data
// that's already been fetched (RLS already did the role-scoping on the way
// in — see each fetcher's own doc comment) and only sorts/groups/filters it
// for display. Kept separate from the components so the "needs stage
// change" filter and the "companies with clients but no manager" grouping
// (the two pieces of real logic the Dashboard brief called out) can be unit
// tested without rendering anything — see dashboard.test.ts.

import { PIPELINE, type Application, type Stage, type TimelineEntry } from "@/lib/mock-data";
import type { Company, ClientProfile } from "@/lib/supabase/companies";

/** Per-stage counts for a status strip, every stage present (zero-filled)
 * so a caller never has to special-case a stage nobody is currently in. */
export function stageCounts(applications: Application[]): Record<Stage, number> {
  const counts = Object.fromEntries(PIPELINE.map((s) => [s.id, 0])) as Record<Stage, number>;
  for (const app of applications) counts[app.stage] += 1;
  return counts;
}

// The three pre-report stages read as "someone at AGV still has to act on
// this" — submitted (needs triage), under-review (in progress), site-visit
// (in progress). report-issued/closed are end states with nothing pending.
// A judgment call, not a locked rule — see the Dashboard report for the
// reasoning kept alongside the code that encodes it.
const ATTENTION_STAGES: Stage[] = ["submitted", "under-review", "site-visit"];

/** Applications plausibly waiting on staff action, oldest submission first
 * (the one that's been waiting longest surfaces at the top). */
export function needsAttention(applications: Application[]): Application[] {
  return applications
    .filter((a) => ATTENTION_STAGES.includes(a.stage))
    .sort((a, b) => (a.submitted < b.submitted ? -1 : a.submitted > b.submitted ? 1 : 0));
}

/** The `limit` most recently submitted applications, newest first. Submitted
 * date is the only recency signal `fetchApplications()` carries (no
 * updated-at column) — see mock-data.ts's `Application` type. */
export function mostRecentlyActive(applications: Application[], limit: number): Application[] {
  return [...applications]
    .sort((a, b) => (a.submitted < b.submitted ? 1 : a.submitted > b.submitted ? -1 : 0))
    .slice(0, limit);
}

export type ActivityDigestEntry = TimelineEntry & {
  applicationId: string;
  applicationTitle: string;
};

/** Merges each application's own (already RLS-filtered, see
 * fetchApplicationByReference's doc comment) timeline into one
 * cross-application feed, most recent entry first, capped at `limit`. */
export function buildActivityDigest(
  entries: { application: Pick<Application, "id" | "title">; timeline: TimelineEntry[] }[],
  limit: number
): ActivityDigestEntry[] {
  const flat: ActivityDigestEntry[] = entries.flatMap(({ application, timeline }) =>
    timeline.map((t) => ({ ...t, applicationId: application.id, applicationTitle: application.title }))
  );
  return flat.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}

/** Companies with at least one client on the roster but nobody flagged
 * `is_company_manager` — a state where only AGV staff can manage that
 * company's day-to-day access, since nobody on their side holds the grant/
 * revoke tools My Team gives a manager. A company with zero roster members
 * isn't flagged — there's no gap to fill yet, that's the Unassigned-clients
 * queue's job instead. */
export function companiesWithoutManager(companies: Company[], clients: ClientProfile[]): Company[] {
  const rosterByCompany = new Map<string, ClientProfile[]>();
  for (const client of clients) {
    if (!client.company_id) continue;
    const roster = rosterByCompany.get(client.company_id) ?? [];
    roster.push(client);
    rosterByCompany.set(client.company_id, roster);
  }
  return companies.filter((company) => {
    const roster = rosterByCompany.get(company.id);
    return roster !== undefined && roster.length > 0 && !roster.some((c) => c.is_company_manager);
  });
}
