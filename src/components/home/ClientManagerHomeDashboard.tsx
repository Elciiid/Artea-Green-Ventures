"use client";

// Client-manager's /home dashboard — status-at-a-glance, explicitly
// distinct from My Team (/portal/team): this page never reads or renders
// anything about who has access to what, it only links to My Team for that.
//
// CORRECTED (originally shipped reading company-wide scope, found wrong on
// review): a company-manager session's agv_applications RLS additionally
// reads every application within their company's SCOPE (a ceiling My Team's
// own checklist genuinely needs — see 20260806100000_my_team_manager_read.sql)
// — but agv_documents/agv_activity_entries still gate on a personal grant
// only, unaffected by that widening. Calling plain fetchApplications() here
// meant this page (and /portal, and the application-detail route) could show
// and link into applications a manager could open the row for but not
// actually read any documents/activity on — silently rendering "0 of 0
// received" for what's really a partial, gated view, not a genuinely empty
// application. fetchPersonallyGrantedApplications() narrows this back down
// to exactly what a manager can actually open: the same personal-grant-only
// semantics a regular client already has (see its doc comment in
// applications.ts). My Team's own checklist keeps using the wider
// company-scope set on purpose — team.ts's applicationsInScope(), not this.
//
// One consequence worth naming plainly: after this fix, this dashboard's
// application-visibility is now identical to the plain Client dashboard's
// (personal grants only) — the only thing that still distinguishes it is
// the "Manage your team" panel. See the task report for the honest
// assessment of what that means for this page's own reason to exist
// separately.
//
// Deliberately does NOT fetch each application's activity timeline the way
// the plain Client dashboard does: agv_activity_entries' RLS
// ("activity — read granted", role_staff_client.sql) gates on a LIVE
// PERSONAL grant via agv_has_app_access() — which, now that this page only
// reads personally-granted applications anyway, IS satisfied for every
// application it lists. The timeline digest was left out here regardless,
// to keep this fix narrowly scoped to the visibility bug rather than also
// adding a new feature in the same pass; worth reconsidering as a follow-up
// now that the data would actually support it correctly. Recency here is
// still the application's own `submitted` date, the same signal the Staff
// dashboard uses.

import { fetchPersonallyGrantedApplications } from "@/lib/supabase/applications";
import { formatDate } from "@/lib/format";
import { mostRecentlyActive, stageCounts } from "@/lib/dashboard";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";
import SurfaceState from "@/components/SurfaceState";
import StatusChip from "@/components/StatusChip";
import StatusStrip from "@/components/home/StatusStrip";
import HomeShell, { HomePanel, HomePillLink } from "@/components/home/HomeShell";
import Link from "next/link";

const RECENT_LIMIT = 6;

export default function ClientManagerHomeDashboard() {
  const accountId = useSession((s) => s.account?.id);
  const { state } = useAsyncResource(
    () => (accountId ? fetchPersonallyGrantedApplications(accountId) : Promise.resolve([])),
    [accountId],
    "Something went wrong loading your applications."
  );

  return (
    <HomeShell
      eyebrow="Company account"
      title="Dashboard"
      intro="Status across the applications you have access to."
    >
      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading your applications…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load your applications"
        errorHeadingLevel="h2"
        empty={state.status === "ready" && state.data.length === 0}
        emptyContent={
          // Deliberately doesn't say "grant yourself access from My Team" —
          // team.ts's loadTeamData excludes the manager's own row from the
          // roster (`c.id !== selfId`), so My Team has no self-service path
          // for this; only an administrator can grant a manager personal
          // access, same as any other client.
          <p className="text-sm text-ash">
            You don&apos;t have access to any applications yet. Ask an
            administrator to grant you access.
          </p>
        }
        className="glass rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        {state.status === "ready" && (
          <div className="flex flex-col gap-6">
            <HomePanel
              title="Manage your team"
              action={<HomePillLink href="/portal/team">Open My Team →</HomePillLink>}
            >
              <p className="text-sm text-ash">
                Grant or revoke which teammates can see which applications from My Team.
              </p>
            </HomePanel>

            <HomePanel title="Status">
              <StatusStrip counts={stageCounts(state.data)} />
            </HomePanel>

            <HomePanel
              title="Recently submitted"
              action={<HomePillLink href="/portal">All applications →</HomePillLink>}
            >
              {mostRecentlyActive(state.data, RECENT_LIMIT).length === 0 ? (
                <p className="text-sm text-ash">Nothing submitted yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {mostRecentlyActive(state.data, RECENT_LIMIT).map((app) => (
                    <li key={app.id}>
                      <Link
                        href={`/portal/applications/${app.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-bone/[0.04]"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-label tracking-[0.1em] text-ash">
                            {app.id}
                          </span>
                          <span className="block truncate text-sm text-bone">{app.title}</span>
                          <span className="block text-xs text-ash">{formatDate(app.submitted)}</span>
                        </span>
                        <StatusChip stage={app.stage} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </HomePanel>
          </div>
        )}
      </SurfaceState>
    </HomeShell>
  );
}
