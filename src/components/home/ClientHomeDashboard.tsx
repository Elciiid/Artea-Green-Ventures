"use client";

// Client's /home dashboard — a recent activity digest and direct links into
// each application. Originally also carried a status-breakdown strip and a
// full applications list; both dropped (see STATUS.md) as redundant with
// /portal's own table — the digest was the one piece both the implementer
// and an independent reviewer read as genuine new value.
//
// fetchApplications() is already scoped by RLS to this account's own live
// personal grants (agv_has_app_access — "applications — user read granted"),
// so no client-side filtering happens here. The activity digest fetches each
// application's full record (fetchApplicationByReference), whose `timeline`
// field is independently RLS-filtered by agv_activity_entries' own
// "activity — read granted" policy: for a client caller this only ever
// returns rows with visible_to_client = true (confirmed by reading
// supabase/migrations/20260723090000_role_staff_client.sql) — so nothing
// staff-internal leaks into this digest, no extra filtering needed here
// either. Only the most-recently-submitted few applications are expanded for
// the digest (not every application this account can see), to keep this to a
// small, bounded number of network calls.
//
// See buildActivityDigest (src/lib/dashboard.ts) for the pure merge/sort of
// the fetched timelines — unit tested there, since it's the one non-network
// non-JSX piece of logic in this data path.

import Link from "next/link";
import { fetchApplicationByReference, fetchApplications } from "@/lib/supabase/applications";
import type { Application } from "@/lib/mock-data";
import { formatDate } from "@/lib/format";
import { buildActivityDigest, mostRecentlyActive, type ActivityDigestEntry } from "@/lib/dashboard";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";
import SurfaceState from "@/components/SurfaceState";
import HomeShell, { HomePanel } from "@/components/home/HomeShell";

const DIGEST_APPLICATION_LIMIT = 5;
const DIGEST_ENTRY_LIMIT = 6;

type ClientDashboardData = {
  applications: Application[];
  digest: ActivityDigestEntry[];
};

async function loadClientDashboard(): Promise<ClientDashboardData> {
  const applications = await fetchApplications();
  const recent = mostRecentlyActive(applications, DIGEST_APPLICATION_LIMIT);
  const full = await Promise.all(recent.map((a) => fetchApplicationByReference(a.id)));
  const digestInputs = full
    .filter((a): a is Application => a !== null)
    .map((a) => ({ application: a, timeline: a.timeline }));
  return { applications, digest: buildActivityDigest(digestInputs, DIGEST_ENTRY_LIMIT) };
}

const TIMELINE_KIND_LABEL: Record<ActivityDigestEntry["kind"], string> = {
  status: "Status",
  comment: "Note",
  document: "Document",
  system: "System",
};

export default function ClientHomeDashboard() {
  const accountId = useSession((s) => s.account?.id);
  const { state } = useAsyncResource(
    loadClientDashboard,
    [accountId],
    "Something went wrong loading your applications."
  );

  return (
    <HomeShell eyebrow="Your portal" title="Dashboard" intro="A quick look at your applications.">
      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading your applications…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load your applications"
        errorHeadingLevel="h2"
        empty={state.status === "ready" && state.data.applications.length === 0}
        emptyContent={
          <p className="text-sm text-ash">
            You don&apos;t have access to any applications yet. Ask an administrator to grant you access.
          </p>
        }
        className="glass rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        {state.status === "ready" && (
          <HomePanel title="Recent activity">
            {state.data.digest.length === 0 ? (
              <p className="text-sm text-ash">Nothing to show yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {state.data.digest.map((entry, i) => (
                  <li key={i}>
                    <Link
                      href={`/portal/applications/${entry.applicationId}`}
                      className="block rounded-lg px-2 py-1.5 transition hover:bg-bone/[0.04]"
                    >
                      <span className="flex items-center gap-2 text-xs text-ash">
                        <span>{formatDate(entry.at)}</span>
                        <span aria-hidden>·</span>
                        <span className="uppercase tracking-[0.08em]">
                          {TIMELINE_KIND_LABEL[entry.kind]}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm text-bone">{entry.text}</span>
                      <span className="mt-0.5 block truncate text-xs text-ash">
                        {entry.applicationId} · {entry.applicationTitle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </HomePanel>
        )}
      </SurfaceState>
    </HomeShell>
  );
}
