"use client";

// Full single-application view, shared by the client portal (Phase 3) and —
// in Phase 4 — the admin detail route, which will layer edit controls on top
// via `canEdit`. Nothing here is role-specific: it renders whatever
// application it's given, read-only by default.
//
// Note on color logic: the stepper uses POSITION-relative colors (done =
// Contour, current = Amber pulsing, upcoming = dim Ash) — deliberately
// distinct from the StatusChip's 3-tier semantics.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import StatusChip from "@/components/StatusChip";
import { formatDate } from "@/lib/format";
import {
  PIPELINE,
  stageIndex,
  type Application,
  type DocumentItem,
} from "@/lib/mock-data";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Props = {
  app: Application;
  /** Phase 4: admins get status/note controls layered on top. Read-only for now. */
  canEdit?: boolean;
};

export default function ApplicationDetail({ app, canEdit = false }: Props) {
  const reduced = useReducedMotion();
  const current = stageIndex(app.stage);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const enter = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay: i * 0.09, ease: EASE },
        };

  // canEdit is accepted now so Phase 4 can slot controls in without an API
  // change; no edit UI exists yet by design.
  void canEdit;

  return (
    <div>
      {/* ——— header ——— */}
      <motion.div {...enter(0)}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] tracking-[0.14em] text-ash">{app.id}</span>
          <StatusChip stage={app.stage} note={app.statusNote} />
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-3xl font-black tracking-[-0.02em] text-bone sm:text-4xl lg:text-5xl">
          {app.title}
        </h1>
        <p className="mt-2 text-sm text-ash">{app.service}</p>

        <dl className="mt-7 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-t border-ash/10 pt-6 sm:grid-cols-3">
          <Meta k="Sector" v={app.sector} />
          <Meta k="Location" v={app.location} />
          <Meta k="Client" v={app.clientName} />
          <Meta k="AGV lead" v={app.lead} />
          <Meta k="Submitted" v={formatDate(app.submitted)} />
          <Meta k="Coordinates" v={app.coords} mono />
        </dl>
      </motion.div>

      {/* ——— status stepper ——— */}
      <motion.section
        {...enter(1)}
        aria-label="Pipeline position"
        className="mt-10 rounded-xl border border-ash/15 bg-pine p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            Pipeline position
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ash/60">
            Stage {current + 1} of {PIPELINE.length}
          </span>
        </div>

        <div className="relative mt-9">
          {/* track + progress, spanning first to last node centers */}
          <div aria-hidden className="absolute left-[10%] right-[10%] top-[13px] h-px bg-ash/20" />
          <motion.div
            aria-hidden
            className="absolute left-[10%] top-[13px] h-px bg-contour"
            initial={reduced ? false : { width: "0%" }}
            animate={{ width: `${current * 20}%` }}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
          />

          <ol className="relative grid grid-cols-5">
            {PIPELINE.map((stage, i) => {
              const state = i < current ? "done" : i === current ? "current" : "todo";
              return (
                <li
                  key={stage.id}
                  aria-current={state === "current" ? "step" : undefined}
                  className="flex flex-col items-center gap-3 text-center"
                >
                  {state === "done" && (
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-contour bg-contour/15 text-contour">
                      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                        <path
                          d="M2.5 6.5l2.5 2.5 4.5-5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  {state === "current" && (
                    <span className="step-pulse flex h-[26px] w-[26px] items-center justify-center rounded-full border border-amber bg-amber/20">
                      <span className="h-2 w-2 rounded-full bg-amber" aria-hidden />
                    </span>
                  )}
                  {state === "todo" && (
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-ash/30 bg-void/40">
                      <span className="h-1.5 w-1.5 rounded-full bg-ash/30" aria-hidden />
                    </span>
                  )}
                  <span
                    className={`px-1 font-mono text-[9px] uppercase leading-tight tracking-[0.1em] sm:text-[10px] sm:tracking-[0.14em] ${
                      state === "done"
                        ? "text-contour/80"
                        : state === "current"
                          ? "text-amber"
                          : "text-ash/45"
                    }`}
                  >
                    {stage.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </motion.section>

      {/* ——— documents + activity ——— */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <motion.section
          {...enter(2)}
          aria-label="Documents"
          className="min-w-0 rounded-xl border border-ash/15 bg-pine p-6 lg:col-span-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">Documents</h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ash/60">
              {app.documents.filter((d) => d.status === "received").length} of{" "}
              {app.documents.length} received
            </span>
          </div>

          <ul className="mt-4 divide-y divide-ash/10">
            {app.documents.map((doc) => (
              <li key={doc.name} className="flex items-center gap-4 py-3.5">
                <FileBadge name={doc.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone">{doc.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-ash">
                    {doc.kind} · {doc.size} ·{" "}
                    {doc.uploaded ? formatDate(doc.uploaded) : "awaiting upload"}
                  </p>
                </div>
                {doc.status === "received" ? (
                  <button
                    type="button"
                    onClick={() => showToast("Preview isn't wired up in this demo.")}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-signal transition hover:brightness-125"
                  >
                    View
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full border border-amber/40 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber">
                    Pending
                  </span>
                )}
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          {...enter(3)}
          aria-label="Activity"
          className="min-w-0 rounded-xl border border-ash/15 bg-pine p-6 lg:col-span-2"
        >
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">Activity</h2>

          <ol className="relative mt-5">
            <span aria-hidden className="absolute bottom-1 left-[3px] top-1 w-px bg-ash/15" />
            {app.timeline.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="relative pb-6 pl-6 last:pb-0">
                <span
                  aria-hidden
                  className={`absolute left-0 top-1 h-[7px] w-[7px] rounded-full ${
                    entry.kind === "system" ? "bg-ash/40" : "bg-ash/80"
                  }`}
                />
                <p className="font-mono text-[10px] tracking-[0.08em] text-ash">
                  {formatDate(entry.at)} — {entry.actor}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-bone/90">{entry.text}</p>
              </li>
            ))}
          </ol>
        </motion.section>
      </div>

      {/* ——— toast ——— */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 10 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ash/25 bg-pine px-5 py-2.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8)]"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber" />
              <span className="text-xs text-bone">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Meta({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">{k}</dt>
      <dd className={`mt-1.5 text-sm text-bone ${mono ? "font-mono text-[13px]" : ""}`}>{v}</dd>
    </div>
  );
}

const EXT_LABEL: Record<string, string> = {
  pdf: "PDF",
  xlsx: "XLS",
  xls: "XLS",
  zip: "ZIP",
  docx: "DOC",
};

function FileBadge({ name }: { name: DocumentItem["name"] }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const label = EXT_LABEL[ext] ?? ext.slice(0, 3).toUpperCase();
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ash/20 bg-void/60 font-mono text-[9px] tracking-[0.08em] text-ash"
    >
      {label}
    </span>
  );
}
