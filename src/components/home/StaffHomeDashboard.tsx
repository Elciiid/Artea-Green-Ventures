"use client";

// Staff's Dashboard (/dashboard). fetchApplications() already returns only the
// applications this staff account holds a live grant for (RLS — see
// applications.ts's own doc comment); nothing here assumes admin-level
// visibility into every application in the system.

import Link from "next/link";
import { fetchApplications } from "@/lib/supabase/applications";
import type { Application } from "@/lib/mock-data";
import { formatDate } from "@/lib/format";
import { needsAttention, mostRecentlyActive, stageCounts } from "@/lib/dashboard";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";
import SurfaceState from "@/components/SurfaceState";
import StatusChip from "@/components/StatusChip";
import StatusStrip from "@/components/home/StatusStrip";
import HomeShell, { HomePanel, HomePillLink } from "@/components/home/HomeShell";

const RECENT_LIMIT = 5;
const ATTENTION_LIMIT = 5;

export default function StaffHomeDashboard() {
  const accountId = useSession((s) => s.account?.id);
  const { state } = useAsyncResource(
    fetchApplications,
    [accountId],
    "Something went wrong loading your applications."
  );

  return (
    <HomeShell
      eyebrow="Staff"
      title="Dashboard"
      intro="A quick read on the applications you have access to."
    >
      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading your applications…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load your applications"
        errorHeadingLevel="h2"
        empty={state.status === "ready" && state.data.length === 0}
        emptyContent={
          <p className="text-sm text-ash">
            You don&apos;t have access to any applications yet. Ask an administrator to grant you access.
          </p>
        }
        className="glass rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        {state.status === "ready" && (
          <div className="flex flex-col gap-6">
            <HomePanel title="Status">
              <StatusStrip counts={stageCounts(state.data)} />
            </HomePanel>

            <div className="grid gap-6 lg:grid-cols-2">
              <HomePanel title="Needs attention">
                <ApplicationList
                  applications={needsAttention(state.data).slice(0, ATTENTION_LIMIT)}
                  emptyLabel="Nothing is waiting on a stage change right now."
                />
              </HomePanel>

              <HomePanel
                title="Recently submitted"
                action={<HomePillLink href="/portal">All applications →</HomePillLink>}
              >
                <ApplicationList
                  applications={mostRecentlyActive(state.data, RECENT_LIMIT)}
                  emptyLabel="Nothing submitted yet."
                />
              </HomePanel>
            </div>
          </div>
        )}
      </SurfaceState>
    </HomeShell>
  );
}

function ApplicationList({
  applications,
  emptyLabel,
}: {
  applications: Application[];
  emptyLabel: string;
}) {
  if (applications.length === 0) {
    return <p className="text-sm text-ash">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {applications.map((app) => (
        <li key={app.id}>
          <Link
            href={`/portal/applications/${app.id}`}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-bone/[0.04]"
          >
            <span className="min-w-0">
              <span className="block font-mono text-label tracking-[0.1em] text-ash">{app.id}</span>
              <span className="block truncate text-sm text-bone">{app.title}</span>
              <span className="block text-xs text-ash">{formatDate(app.submitted)}</span>
            </span>
            <StatusChip stage={app.stage} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
