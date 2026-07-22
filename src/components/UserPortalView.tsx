"use client";

// The portal home for a normal user: a register of only the applications
// they've been granted access to (admins never reach /portal — the shell
// routes them to /admin). Shares ApplicationRegister with the admin view.
// Phase 10b-2 — reads real Supabase data; RLS (10b-1) already restricts the
// rows to whatever this account holds a live grant for, so there's no
// client-side visibility filtering here anymore.

import { useEffect, useState } from "react";
import ApplicationRegister from "@/components/ApplicationRegister";
import RegisterStatus from "@/components/RegisterStatus";
import { fetchApplications } from "@/lib/supabase/applications";
import { useSession } from "@/lib/session";
import type { Application } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; applications: Application[] };

export default function UserPortalView() {
  const accountId = useSession((s) => s.account?.id);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchApplications()
      .then((applications) => {
        if (!cancelled) setState({ status: "ready", applications });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              e instanceof Error ? e.message : "Something went wrong loading your applications.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (state.status === "loading") {
    return <RegisterStatus eyebrow="Your portal" title="Your applications" kind="loading" />;
  }
  if (state.status === "error") {
    return (
      <RegisterStatus
        eyebrow="Your portal"
        title="Your applications"
        kind="error"
        message={state.message}
      />
    );
  }

  const mine = state.applications;
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
