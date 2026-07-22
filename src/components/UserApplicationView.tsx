"use client";

// User-facing application detail: read-only for a client, editable for
// staff on an application they hold a live grant for (Phase 10b-3b — staff
// got real write rights in 10b-3a's role model change; client stays
// read-only always, no exceptions). RLS (10b-1) already returns null for an
// application this account has no live grant for, so there's no separate
// client-side visibility check; "doesn't exist" and "not granted" collapse
// into the same state on purpose. canEdit here only controls whether edit
// controls are SHOWN — Postgres, not this component, decides whether a
// write actually succeeds.

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationDetail from "@/components/ApplicationDetail";
import {
  addActivityNote,
  changeApplicationStage,
  fetchApplicationByReference,
} from "@/lib/supabase/applications";
import { useSession } from "@/lib/session";
import type { Application, Stage } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "blocked" }
  | { status: "ready"; app: Application };

export default function UserApplicationView({ id }: { id: string }) {
  const account = useSession((s) => s.account);
  const accountId = account?.id;
  const canEdit = account?.role === "staff";

  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — falls through to the unavailable state
  }

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchApplicationByReference(clean)
      .then((app) => {
        if (cancelled) return;
        setState(app ? { status: "ready", app } : { status: "blocked" });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Something went wrong loading this application.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [clean, accountId]);

  async function handleStageChange(stage: Stage, actor: string) {
    await changeApplicationStage(clean, stage, actor);
    const app = await fetchApplicationByReference(clean);
    if (app) setState({ status: "ready", app });
  }

  async function handleAddNote(text: string, actor: string) {
    await addActivityNote(clean, actor, text);
    const app = await fetchApplicationByReference(clean);
    if (app) setState({ status: "ready", app });
  }

  return (
    <>
      <Link
        href="/portal"
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash transition hover:text-signal"
      >
        ← Back to your applications
      </Link>

      {state.status === "ready" ? (
        <div className="mt-8">
          <ApplicationDetail
            app={state.app}
            canEdit={canEdit}
            onStageChange={canEdit ? handleStageChange : undefined}
            onAddNote={canEdit ? handleAddNote : undefined}
          />
        </div>
      ) : state.status === "loading" ? (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <p
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-3 text-sm text-ash"
          >
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
            />
            Loading…
          </p>
        </div>
      ) : state.status === "error" ? (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            We couldn&apos;t load this application
          </h1>
          <p className="mt-2 text-sm text-ash">{state.message}</p>
        </div>
      ) : (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            You don&apos;t have access to this application
          </h1>
          <p className="mt-2 text-sm text-ash">
            It isn&apos;t one of your applications. Ask an administrator if you
            need access to it.
          </p>
        </div>
      )}
    </>
  );
}
