"use client";

// /admin register: every application in a sortable table, straight through to
// its detail page. Phase 10b-2 — reads real Supabase data via
// fetchApplications(); RLS (Phase 10b-1) already returns every row for an
// admin, so this component does no filtering of its own.

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

export default function AdminDashboard() {
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
              e instanceof Error ? e.message : "Something went wrong loading applications.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the signed-in identity changes — the dev QuickSwitch
    // can move between two "user" accounts without a route change, since
    // both land on the same /portal path.
  }, [accountId]);

  if (state.status === "loading") {
    return <RegisterStatus eyebrow="Admin console" title="Applications" kind="loading" />;
  }
  if (state.status === "error") {
    return (
      <RegisterStatus
        eyebrow="Admin console"
        title="Applications"
        kind="error"
        message={state.message}
      />
    );
  }

  const applications = state.applications;
  return (
    <ApplicationRegister
      eyebrow="Admin console"
      title="Applications"
      intro={`All ${applications.length} applications on record. Select a reference number to review an application's status, documents, and activity — or to update it.`}
      applications={applications}
      hrefBase="/admin/applications"
    />
  );
}
