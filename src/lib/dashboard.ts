// Pure computations behind the Dashboard variants (src/components/home).
// stageCounts/needsAttention/mostRecentlyActive/buildActivityDigest were
// removed here (2026-08-08) along with StaffHomeDashboard.tsx/
// ClientHomeDashboard.tsx, their only callers — see STATUS.md for why those
// two dashboards were dropped entirely rather than kept around unused.
// companiesWithoutManager is the one survivor: a real, tested pure function
// that's currently unreferenced by any component (AdminHomeDashboard
// deliberately dropped it as a dashboard panel — see that file's own
// comment), kept because it predates and is unrelated to this pass's
// cleanup, not because anything here still calls it. Flagged, not silently
// removed as a drive-by.

import type { Company, ClientProfile } from "@/lib/supabase/companies";

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
