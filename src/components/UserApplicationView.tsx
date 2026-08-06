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
//
// One deliberate EXCEPTION to "no separate client-side visibility check",
// added after review found a real gap: a company-manager session's
// agv_applications RLS also reads every application within their company's
// SCOPE (needed for My Team's own checklist — see
// 20260806100000_my_team_manager_read.sql), which is wider than what
// agv_documents/agv_activity_entries will actually let them read (both still
// gate on a personal grant only, unchanged). Without the extra check below,
// a manager who typed or clicked into a scope-only, not-personally-granted
// application's URL would land on `status: "ready"` with a real title but
// silently empty documents/timeline — "0 of 0 received", no indication this
// is a partial view rather than a genuinely empty application, which is
// exactly the wrong failure mode for a compliance product. The extra check
// only runs for a company-manager account; every other role's visibility is
// still decided by RLS alone, as the comment above describes.

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationDetail from "@/components/ApplicationDetail";
import {
  addActivityNote,
  changeApplicationStage,
  fetchApplicationByReference,
  findApplicationId,
  hasPersonalApplicationGrant,
} from "@/lib/supabase/applications";
import { uploadDocument } from "@/lib/supabase/documents";
import { useSession } from "@/lib/session";
import type { Application, Stage } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "blocked" }
  /** The application row is readable (company scope), but the caller holds
   * no personal grant on it — documents/activity can't actually be shown. */
  | { status: "scope-only" }
  | { status: "ready"; app: Application };

export default function UserApplicationView({ id }: { id: string }) {
  const account = useSession((s) => s.account);
  const accountId = account?.id;
  const canEdit = account?.role === "staff";
  const isManager = account?.role === "client" && account.isCompanyManager;

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
    (async () => {
      const app = await fetchApplicationByReference(clean);
      if (cancelled) return;
      if (!app) {
        setState({ status: "blocked" });
        return;
      }
      if (isManager && accountId) {
        const applicationId = await findApplicationId(clean);
        const granted =
          applicationId !== null && (await hasPersonalApplicationGrant(applicationId, accountId));
        if (cancelled) return;
        if (!granted) {
          setState({ status: "scope-only" });
          return;
        }
      }
      setState({ status: "ready", app });
    })().catch((e: unknown) => {
      if (cancelled) return;
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong loading this application.",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [clean, accountId, isManager]);

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

  async function handleUploadDocument(documentId: string, file: File, actor: string) {
    await uploadDocument(clean, documentId, file, actor);
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
            onUploadDocument={canEdit ? handleUploadDocument : undefined}
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
      ) : state.status === "scope-only" ? (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            You don&apos;t have personal access to this application yet
          </h1>
          <p className="mt-2 text-sm text-ash">
            It&apos;s within your company&apos;s scope, but nobody has granted
            you personal access to it — that&apos;s what unlocks its documents
            and activity. Ask an administrator to grant you access.
          </p>
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
