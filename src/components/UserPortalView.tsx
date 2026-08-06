"use client";

// The portal home for a normal user: a register of only the applications
// they've been granted access to (admins never reach /portal — the shell
// routes them to /admin). Shares ApplicationRegister with the admin view.
// Phase 10b-2 — reads real Supabase data; RLS (10b-1) already restricts the
// rows to whatever this account holds a live grant for, so there's no
// client-side visibility filtering here anymore.
//
// EXCEPT for a company-manager: My Team's migration widened agv_applications'
// RLS so a manager can also read every application in their company's SCOPE
// (a grant ceiling My Team's own checklist needs), which — because RLS is
// table-wide, not query-scoped — leaked into fetchApplications() generally.
// agv_documents/agv_activity_entries still gate on a personal grant only, so
// a scope-only application would render here as clickable but then open to a
// fake "0 of 0 received" empty page. fetchPersonallyGrantedApplications()
// narrows back down to exactly what a manager can actually open — the same
// personal-grant-only semantics a regular client already has (see its own
// doc comment in applications.ts for the full story).

import ApplicationRegister from "@/components/ApplicationRegister";
import SurfaceState from "@/components/SurfaceState";
import { fetchApplications, fetchPersonallyGrantedApplications } from "@/lib/supabase/applications";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";

export default function UserPortalView() {
  const account = useSession((s) => s.account);
  const { state } = useAsyncResource(
    () =>
      account?.isCompanyManager && account.id
        ? fetchPersonallyGrantedApplications(account.id)
        : fetchApplications(),
    [account?.id, account?.isCompanyManager],
    "Something went wrong loading your applications."
  );

  if (state.status !== "ready") {
    return (
      <div>
        <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
          Your portal
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
          Your applications
        </h1>
        <SurfaceState
          loading={state.status === "loading"}
          loadingLabel="Loading applications…"
          error={state.status === "error" ? state.message : null}
          errorHeading="We couldn&apos;t load your applications"
          empty={false}
          emptyContent={null}
          className="glass mt-9 rounded-2xl py-16 text-center backdrop-blur-xl"
        >
          {null}
        </SurfaceState>
      </div>
    );
  }

  const mine = state.data;
  return (
    <ApplicationRegister
      eyebrow="Your portal"
      title="Your applications"
      intro={
        mine.length === 1
          ? "You have access to 1 application. Select its reference number to review its status, documents, and activity."
          : `You have access to ${mine.length} applications. Select a reference number to review its status, documents, and activity.`
      }
      applications={mine}
      hrefBase="/portal/applications"
      emptyState={
        <div className="rounded-md border border-dashed border-ash/30 bg-pine/40 px-6 py-16 text-center">
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-ash">
            Nothing to show yet
          </p>
          <p className="mt-2 text-sm text-ash">
            You don&apos;t have access to any applications yet. Ask an
            administrator to grant you access.
          </p>
        </div>
      }
    />
  );
}
