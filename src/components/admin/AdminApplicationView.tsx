"use client";

// Admin detail view: the same ApplicationDetail the user portal uses, with
// edit controls enabled. Phase 10b-2 fetches the real record from Supabase
// (fetchApplicationByReference) instead of the mock store.
//
// Status changes and notes stay LOCAL to this component's state for this
// slice — 10b-2 is read-only against Supabase by design (writes land in
// 10b-3). Routing them through onStageChange/onAddNote instead of hiding the
// controls keeps Phase 16's interaction intact; a refresh discards the edit,
// which is the honest behavior until 10b-3 makes it a real write.

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationDetail from "@/components/ApplicationDetail";
import { fetchApplicationByReference } from "@/lib/supabase/applications";
import { useSession } from "@/lib/session";
import { PIPELINE, type Application, type Stage } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found" }
  | { status: "ready"; app: Application };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminApplicationView({ id }: { id: string }) {
  const accountId = useSession((s) => s.account?.id);

  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — fall through to the unknown state
  }

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchApplicationByReference(clean)
      .then((app) => {
        if (cancelled) return;
        setState(app ? { status: "ready", app } : { status: "not-found" });
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

  function handleStageChange(stage: Stage, actor: string) {
    setState((s) => {
      if (s.status !== "ready") return s;
      const label = PIPELINE.find((p) => p.id === stage)?.label ?? stage;
      return {
        status: "ready",
        app: {
          ...s.app,
          stage,
          statusNote: undefined,
          timeline: [
            ...s.app.timeline,
            { at: todayIso(), actor, kind: "status" as const, text: `Status moved to ${label}.` },
          ],
        },
      };
    });
  }

  function handleAddNote(text: string, actor: string) {
    setState((s) => {
      if (s.status !== "ready") return s;
      return {
        status: "ready",
        app: {
          ...s.app,
          timeline: [
            ...s.app.timeline,
            { at: todayIso(), actor, kind: "comment" as const, text },
          ],
        },
      };
    });
  }

  return (
    <>
      <Link
        href="/admin"
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash transition hover:text-signal"
      >
        ← Back to all applications
      </Link>

      {state.status === "ready" ? (
        <div className="mt-8">
          <ApplicationDetail
            app={state.app}
            canEdit
            onStageChange={handleStageChange}
            onAddNote={handleAddNote}
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
            We couldn&apos;t find this application
          </h1>
          <p className="mt-2 text-sm text-ash">
            Nothing matches that reference number. Check the link, or go back to
            all applications.
          </p>
        </div>
      )}
    </>
  );
}
