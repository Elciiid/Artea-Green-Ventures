"use client";

// /admin register: every application in a sortable table, straight through to
// its detail page. Phase 10b-2 — reads real Supabase data via
// fetchApplications(); RLS (Phase 10b-1) already returns every row for an
// admin, so this component does no filtering of its own.

import ApplicationRegister from "@/components/ApplicationRegister";
import SurfaceState from "@/components/SurfaceState";
import { fetchApplications } from "@/lib/supabase/applications";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";

export default function AdminDashboard() {
  const accountId = useSession((s) => s.account?.id);
  // Re-fetch whenever the signed-in identity changes, since switching
  // accounts doesn't always trigger a route change.
  const { state } = useAsyncResource(
    fetchApplications,
    [accountId],
    "Something went wrong loading applications."
  );

  if (state.status !== "ready") {
    return (
      <div>
        <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
          Admin console
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
          Applications
        </h1>
        <SurfaceState
          loading={state.status === "loading"}
          loadingLabel="Loading applications…"
          error={state.status === "error" ? state.message : null}
          errorHeading="We couldn&apos;t load applications"
          empty={false}
          emptyContent={null}
          className="glass mt-9 rounded-2xl py-16 text-center backdrop-blur-xl"
        >
          {null}
        </SurfaceState>
      </div>
    );
  }

  const applications = state.data;
  return (
    <ApplicationRegister
      eyebrow="Admin console"
      title="Applications"
      intro={`All ${applications.length} applications on record. Select a reference number to review an application's status, documents, and activity — or to update it.`}
      applications={applications}
      hrefBase="/admin/applications"
      emptyState={
        <div className="rounded-md border border-dashed border-ash/30 bg-pine/40 px-6 py-16 text-center">
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-ash">
            Nothing to show yet
          </p>
          <p className="mt-2 text-sm text-ash">
            No applications have been submitted yet. They&apos;ll appear here
            as soon as one comes in.
          </p>
        </div>
      }
    />
  );
}
