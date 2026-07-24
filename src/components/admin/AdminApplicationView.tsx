"use client";

// Admin detail view: the same ApplicationDetail the user portal uses, with
// edit controls enabled. Fetches the real record from Supabase
// (fetchApplicationByReference); status changes and notes are real writes
// (Phase 10b-3b) against agv_applications/agv_activity_entries — admin has
// unconditional write access via the "applications — admin all" RLS policy
// (10b-1), no grant needed. After a successful write, the component
// refetches rather than hand-reconstructing the new state client-side, so
// the UI always reflects exactly what's in the database.

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationDetail from "@/components/ApplicationDetail";
import InviteClientForm from "@/components/admin/InviteClientForm";
import {
  addActivityNote,
  changeApplicationStage,
  fetchApplicationByReference,
  findApplicationId,
} from "@/lib/supabase/applications";
import { uploadDocument } from "@/lib/supabase/documents";
import { useSession } from "@/lib/session";
import type { Application, Stage } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found" }
  | { status: "ready"; app: Application; applicationId: string | null };

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
    Promise.all([fetchApplicationByReference(clean), findApplicationId(clean)])
      .then(([app, applicationId]) => {
        if (cancelled) return;
        setState(app ? { status: "ready", app, applicationId } : { status: "not-found" });
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
    const [app, applicationId] = await Promise.all([
      fetchApplicationByReference(clean),
      findApplicationId(clean),
    ]);
    if (app) setState({ status: "ready", app, applicationId });
  }

  async function handleAddNote(text: string, actor: string) {
    await addActivityNote(clean, actor, text);
    const [app, applicationId] = await Promise.all([
      fetchApplicationByReference(clean),
      findApplicationId(clean),
    ]);
    if (app) setState({ status: "ready", app, applicationId });
  }

  async function handleUploadDocument(documentId: string, file: File, actor: string) {
    await uploadDocument(clean, documentId, file, actor);
    const [app, applicationId] = await Promise.all([
      fetchApplicationByReference(clean),
      findApplicationId(clean),
    ]);
    if (app) setState({ status: "ready", app, applicationId });
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
        <div className="mt-8 space-y-6">
          {state.applicationId && (
            <InviteClientForm
              applicationId={state.applicationId}
              applicationReference={clean}
            />
          )}
          <ApplicationDetail
            app={state.app}
            canEdit
            onStageChange={handleStageChange}
            onAddNote={handleAddNote}
            onUploadDocument={handleUploadDocument}
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
