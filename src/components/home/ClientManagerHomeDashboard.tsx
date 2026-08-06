"use client";

// Client-manager's /home dashboard — status-at-a-glance across the
// manager's own company, explicitly distinct from My Team (/portal/team):
// this page never reads or renders anything about who has access to what,
// it only links to My Team for that. fetchApplications() is enough on its
// own here: a company-manager session gets a widened agv_applications SELECT
// policy ("applications — manager read company scope", added by
// 20260806100000_my_team_manager_read.sql) that returns every application in
// their OWN company's scope — not admin-wide, not another company's — so no
// extra company_id filtering is needed or possible to add client-side; the
// same call a plain client makes already returns the right, wider set for a
// manager purely because of who's asking.
//
// Deliberately does NOT fetch each application's activity timeline the way
// the plain Client dashboard does: agv_activity_entries' RLS
// ("activity — read granted", role_staff_client.sql) still gates on a LIVE
// PERSONAL grant via agv_has_app_access(), which the company-scope widening
// above does not extend to activity rows. A manager who hasn't personally
// been granted a given in-scope application would silently get zero
// timeline rows for it — the same gap 20260806100000's own header comment
// documents for a different table. Recency here is therefore the
// application's own `submitted` date, the same signal the Staff dashboard
// uses, not an activity digest.

import { fetchApplications } from "@/lib/supabase/applications";
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
    fetchApplications,
    [accountId],
    "Something went wrong loading your company's applications."
  );

  return (
    <HomeShell
      eyebrow="Company account"
      title="Dashboard"
      intro="Status across your company's applications."
    >
      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading your company's applications…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load your company's applications"
        errorHeadingLevel="h2"
        empty={state.status === "ready" && state.data.length === 0}
        emptyContent={
          <p className="text-sm text-ash">
            Your company doesn&apos;t have any applications in scope yet.
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
              title="Recently changed"
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
