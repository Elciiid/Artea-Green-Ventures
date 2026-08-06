// My Team (client-manager grant/revoke) data layer. Composes existing
// fetchers from access.ts and companies.ts rather than duplicating their
// query logic — every read below is a call already written and tested for
// the admin-facing AccessMatrix/CompanyDetail surfaces, correct here too
// because it's RLS (this task's new migration,
// 20260806100000_my_team_manager_read.sql) that actually narrows the rows a
// manager's session can see, not anything client-side. grantAccess/
// revokeAccess are intentionally NOT re-exported or wrapped here — MyTeam.tsx
// imports them straight from access.ts, unchanged, same as AccessMatrix does.

import {
  fetchApplicationsForAccess,
  fetchLiveGrants,
  type AccessApplication,
  type LiveGrant,
} from "@/lib/supabase/access";
import {
  fetchClientProfiles,
  fetchCompanyApplicationGrants,
  type ClientProfile,
  type CompanyApplicationGrant,
} from "@/lib/supabase/companies";

export type TeamData = {
  /** Fellow same-company clients — the manager's own row is excluded; you
   * don't grant/revoke your own access from this page. */
  roster: ClientProfile[];
  /** Applications within this company's live scope, with title/reference —
   * the read-only ceiling a manager may grant within. */
  applications: AccessApplication[];
  /** Every live grant this session can see — scoped by RLS (own grants plus
   * every teammate's, for a manager) to exactly what My Team needs to render
   * the roster's checklists. */
  grants: LiveGrant[];
};

/**
 * Narrows every application the caller can currently read down to just this
 * company's live scope. Pure and exported separately (see team.test.ts) —
 * the one piece of real filtering logic in this module; everything else here
 * is a network call.
 */
export function applicationsInScope(
  applications: AccessApplication[],
  scopeGrants: CompanyApplicationGrant[]
): AccessApplication[] {
  const scopedIds = new Set(scopeGrants.map((g) => g.application_id));
  return applications.filter((app) => scopedIds.has(app.id));
}

/**
 * How many of a teammate's live grants fall within the applications actually
 * rendered in My Team's checklist (`applications`, already narrowed by
 * applicationsInScope() above) — NOT every live grant that teammate holds.
 * `grants` (fetchLiveGrants()) is unscoped: it can include a grant an admin
 * issued OUTSIDE this company's scope (agv_application_access carries no
 * company_id of its own — scope only lives on agv_company_applications), and
 * counting those disagreed with the checklist rendered directly below it
 * (e.g. a teammate could show "3 of 2 apps"). Found on review; regression
 * covered in team.test.ts.
 */
export function inScopeGrantCount(
  grants: LiveGrant[],
  profileId: string,
  applications: AccessApplication[]
): number {
  const inScopeIds = new Set(applications.map((a) => a.id));
  return grants.filter((g) => g.profile_id === profileId && inScopeIds.has(g.application_id)).length;
}

/**
 * Everything My Team needs for one company. `selfId` excludes the manager's
 * own row from the roster (see TeamData.roster). Both `companyId` and
 * `selfId` come from the caller's own session (`account.companyId`/`id`) —
 * never user input — so there's nothing here for a caller to spoof their way
 * into seeing a different company's data with anyway, since every read is
 * independently re-scoped by RLS regardless of what's passed in.
 */
export async function loadTeamData(companyId: string, selfId: string): Promise<TeamData> {
  const [clients, scopeGrants, allApplications, liveGrants] = await Promise.all([
    fetchClientProfiles(),
    fetchCompanyApplicationGrants(companyId),
    fetchApplicationsForAccess(),
    fetchLiveGrants(),
  ]);

  return {
    roster: clients.filter((c) => c.company_id === companyId && c.id !== selfId),
    applications: applicationsInScope(allApplications, scopeGrants),
    grants: liveGrants,
  };
}
