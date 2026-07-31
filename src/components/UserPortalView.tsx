"use client";

// The portal home for a normal user: a register of only the applications
// they've been granted access to (admins never reach /portal — the shell
// routes them to /admin). Shares ApplicationRegister with the admin view.
// Phase 10b-2 — reads real Supabase data; RLS (10b-1) already restricts the
// rows to whatever this account holds a live grant for, so there's no
// client-side visibility filtering here anymore.

import ApplicationRegister from "@/components/ApplicationRegister";
import SurfaceState from "@/components/SurfaceState";
import { fetchApplications } from "@/lib/supabase/applications";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";

export default function UserPortalView() {
  const accountId = useSession((s) => s.account?.id);
  const { state } = useAsyncResource(
    fetchApplications,
    [accountId],
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
