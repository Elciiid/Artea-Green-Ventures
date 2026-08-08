"use client";

// Client-manager's Dashboard (/dashboard) — rebuilt (2026-08-08) onto the
// same visual pattern Admin's dashboard uses (a 4-tile stat row + a 2-column
// panel grid), scoped to the manager's own company instead of the whole
// portal. Replaces the previous status-strip + "Manage your team" + recent-
// list version entirely; see STATUS.md for what that version looked like
// and why this one is shaped differently (a direct product request, not a
// bug fix).
//
// Deliberately has NO activity feed, unlike Admin's dashboard — the same
// unresolved question flagged when this page was first built still holds:
// agv_activity_entries' RLS has no company-scope read path, only a personal-
// grant one (see the git history around 20260806100000), so a real feed
// here would need its own migration + adversarial round this pass doesn't
// do. Left out on purpose rather than half-built.
//
// Every number here is real and comes from the exact same tables/RLS this
// app already relies on elsewhere — no new queries invented, no numbers
// estimated.

import { fetchApplications } from "@/lib/supabase/applications";
import {
  fetchClientProfiles,
  fetchCompanyApplicationGrants,
  type ClientProfile,
} from "@/lib/supabase/companies";
import {
  fetchApplicationsForAccess,
  fetchLiveGrants,
  type AccessApplication,
  type LiveGrant,
} from "@/lib/supabase/access";
import { applicationsInScope, inScopeGrantCount } from "@/lib/supabase/team";
import { TIERS, TIER_OF_STAGE, type Application, type Tier } from "@/lib/mock-data";
import { TIER_DOT } from "@/components/StatusChip";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";
import SurfaceState from "@/components/SurfaceState";
import HomeShell, { HomePanel, HomePillLink, StatTile } from "@/components/home/HomeShell";

type ClientManagerDashboardData = {
  scopedAccessApplications: AccessApplication[];
  scopedApplications: Application[];
  roster: ClientProfile[];
  liveGrants: LiveGrant[];
};

async function loadClientManagerDashboard(
  companyId: string
): Promise<ClientManagerDashboardData> {
  const [scopeGrants, accessApplications, allApplications, allClients, liveGrants] =
    await Promise.all([
      fetchCompanyApplicationGrants(companyId),
      fetchApplicationsForAccess(),
      // Deliberately the WIDE, RLS-scoped fetchApplications() here, not
      // fetchPersonallyGrantedApplications() — see that function's own doc
      // comment, which names this dashboard as a call site that normally
      // MUST use the narrower one. That rule exists to stop a manager from
      // being shown fake "0 of 0 received"/empty-timeline data by linking
      // into a scope-only application's agv_documents/agv_activity_entries,
      // which really do gate on a personal grant only. This page never reads
      // documents/activity and never links into a single application at all
      // — it only tallies `stage`, a real column the same widened RLS policy
      // (20260806100000) already lets a manager read accurately for every
      // application in their company's scope. Using the narrower,
      // personal-grant-only fetch here instead would make this panel's
      // totals silently disagree with the "Applications in scope" tile
      // above it (both are supposed to describe the same "their company's
      // applications" set) whenever a manager hasn't personally been granted
      // every application their company can see — exactly the kind of
      // cross-panel number mismatch this app's own review history has
      // caught and fixed before elsewhere.
      fetchApplications(),
      fetchClientProfiles(),
      fetchLiveGrants(),
    ]);

  // fetchApplications()'s Application.id is the human-readable reference
  // string (toApplication() sets id: row.reference), NOT the real uuid that
  // agv_company_applications/agv_application_access key on — so scope
  // membership has to be resolved through fetchApplicationsForAccess()'s
  // uuid-keyed rows (the same crosswalk fetchPersonallyGrantedApplications()
  // already does), then translated back to Application[] via the shared
  // reference string, not by comparing .id directly against a scope grant's
  // application_id (which would silently match nothing).
  const scopedAccessApplications = applicationsInScope(accessApplications, scopeGrants);
  const scopedReferences = new Set(scopedAccessApplications.map((a) => a.reference));
  const scopedApplications = allApplications.filter((a) => scopedReferences.has(a.id));
  const roster = allClients.filter((c) => c.company_id === companyId);

  return { scopedAccessApplications, scopedApplications, roster, liveGrants };
}

const TIER_LABEL: Record<Tier, string> = {
  neutral: "Pending",
  active: "In progress",
  resolved: "Completed",
};

export default function ClientManagerHomeDashboard() {
  const account = useSession((s) => s.account);
  const companyId = account?.companyId ?? null;
  const selfId = account?.id ?? null;

  const { state } = useAsyncResource(
    () => (companyId ? loadClientManagerDashboard(companyId) : Promise.resolve(null)),
    [companyId],
    "Something went wrong loading your company's dashboard."
  );

  return (
    <HomeShell
      eyebrow="Company account"
      title="Dashboard"
      intro="A snapshot of your company's applications and who on your team can see them."
    >
      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading your dashboard…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load your dashboard"
        errorHeadingLevel="h2"
        empty={false}
        emptyContent={null}
        className="rounded-sm border border-ash/20 bg-pine py-16 text-center shadow-panel"
      >
        {state.status === "ready" && state.data && selfId && (
          <ClientManagerDashboardBody data={state.data} selfId={selfId} />
        )}
      </SurfaceState>
    </HomeShell>
  );
}

function ClientManagerDashboardBody({
  data,
  selfId,
}: {
  data: ClientManagerDashboardData;
  selfId: string;
}) {
  const { scopedAccessApplications, scopedApplications, roster, liveGrants } = data;
  const teammates = roster.filter((c) => c.id !== selfId);

  const withAccess = teammates.filter(
    (t) => inScopeGrantCount(liveGrants, t.id, scopedAccessApplications) > 0
  );
  const withoutAccess = teammates.filter(
    (t) => inScopeGrantCount(liveGrants, t.id, scopedAccessApplications) === 0
  );

  const tierCounts: Record<Tier, number> = { neutral: 0, active: 0, resolved: 0 };
  for (const app of scopedApplications) tierCounts[TIER_OF_STAGE[app.stage]] += 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Applications in scope"
          value={scopedAccessApplications.length}
          note="Your company's current access ceiling"
        />
        <StatTile label="Team roster" value={roster.length} note="Everyone on your company's account" />
        <StatTile label="Teammates with access" value={withAccess.length} note="Have at least one grant" />
        <StatTile
          label="Teammates with zero access"
          value={withoutAccess.length}
          note={teammates.length === 0 ? "No teammates yet" : "Not yet granted anything"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <HomePanel title="Applications by status">
          <StatusDonut counts={tierCounts} />
        </HomePanel>

        <HomePanel
          title="Teammates without access"
          action={<HomePillLink href="/portal/team">Manage in My Team →</HomePillLink>}
        >
          {withoutAccess.length === 0 ? (
            <p className="text-sm text-ash">
              {teammates.length === 0
                ? "You don't have any teammates yet."
                : "Everyone on your team has at least one grant."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {withoutAccess.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal/15 text-xs font-semibold text-signal"
                  >
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm text-bone">{t.name}</span>
                </li>
              ))}
            </ul>
          )}
        </HomePanel>
      </div>
    </div>
  );
}

// Radius/stroke chosen so the ring reads clearly at the panel's usual
// rendered size without needing a chart library — this app has none, and a
// hand-rolled ring keeps the segment colors pinned to the app's own status
// tokens (TIER_DOT) instead of a library's default categorical palette.
const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const TIER_STROKE: Record<Tier, string> = {
  neutral: "text-ash",
  active: "text-amber",
  resolved: "text-contour",
};

function StatusDonut({ counts }: { counts: Record<Tier, number> }) {
  const total = TIERS.reduce((sum, t) => sum + counts[t.id], 0);

  if (total === 0) {
    return <p className="text-sm text-ash">No applications in scope yet.</p>;
  }

  let cursor = 0;
  const segments = TIERS.filter((t) => counts[t.id] > 0).map((tier) => {
    const value = counts[tier.id];
    const length = (value / total) * DONUT_CIRCUMFERENCE;
    const segment = { id: tier.id, value, length, offset: cursor };
    cursor += length;
    return segment;
  });

  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={DONUT_RADIUS} fill="none" stroke="currentColor" strokeWidth="14" className="text-ash/10" />
          {segments.map((seg) => (
            <circle
              key={seg.id}
              cx="50"
              cy="50"
              r={DONUT_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              strokeDasharray={`${seg.length} ${DONUT_CIRCUMFERENCE - seg.length}`}
              strokeDashoffset={-seg.offset}
              className={TIER_STROKE[seg.id]}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-bone">{total}</span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-ash">total</span>
        </div>
      </div>

      <dl className="flex flex-col gap-3">
        {TIERS.map((tier) => (
          <div key={tier.id} className="flex items-center gap-2">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TIER_DOT[tier.id]}`} />
            <dt className="text-sm text-ash">{TIER_LABEL[tier.id]}</dt>
            <dd className="font-bold text-sm text-bone">{counts[tier.id]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
