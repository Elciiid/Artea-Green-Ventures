"use client";

// Full single-application view, shared by the user portal (read-only) and
// the admin detail route (`canEdit` adds a status select and an add-note
// form that write to the reactive applications store).
//
// Phase 16 reworked this from a stack of rounded cards into a ruled document:
// a letterhead leading with the reference number, sections separated by rules
// rather than card borders, a constrained text measure, and a colophon footer.
//
// Color logic note: the stepper uses POSITION-relative colors (done = Contour,
// current = Amber pulsing, upcoming = Ash) — deliberately distinct from the
// StatusChip's 3-tier semantics.

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import StatusChip from "@/components/StatusChip";
import TopoPlate from "@/components/TopoPlate";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import {
  PIPELINE,
  stageIndex,
  type Application,
  type DocumentItem,
  type Stage,
} from "@/lib/mock-data";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Props = {
  app: Application;
  /** admins get a status select and an add-note form */
  canEdit?: boolean;
  /** called with the new stage + the acting user's name; the caller owns persistence. A rejected promise shows an error toast instead of the success one. */
  onStageChange?: (stage: Stage, actor: string) => Promise<void>;
  /** called with the note text + the acting user's name; the caller owns persistence. A rejected promise shows an error toast instead of the success one. */
  onAddNote?: (text: string, actor: string) => Promise<void>;
};

export default function ApplicationDetail({
  app,
  canEdit = false,
  onStageChange: onStageChangeProp,
  onAddNote: onAddNoteProp,
}: Props) {
  const reduced = useReducedMotionPref();
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
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay: i * 0.08, ease: EASE },
        };

  const account = useSession((s) => s.account);
  const actor = account?.name ?? "A. Mercer";
  const [note, setNote] = useState("");

  async function onStageChange(e: ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value as Stage;
    try {
      await onStageChangeProp?.(stage, actor);
      const label = PIPELINE.find((p) => p.id === stage)?.label ?? stage;
      showToast(`Status changed to ${label}.`);
    } catch (err) {
      showToast(err instanceof Error ? `Couldn't save: ${err.message}` : "Couldn't save the status change.");
    }
  }

  async function onNoteSubmit(e: FormEvent) {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    try {
      await onAddNoteProp?.(text, actor);
      setNote("");
      showToast("Note saved.");
    } catch (err) {
      showToast(err instanceof Error ? `Couldn't save: ${err.message}` : "Couldn't save the note.");
    }
  }

  const received = app.documents.filter((d) => d.status === "received").length;

  return (
    <article className="max-w-3xl">
      {/* ——— letterhead ——— */}
      <motion.header {...enter(0)} className="border-b-2 border-bone/80 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-ash">
            Artea Green Ventures · Environmental compliance
          </p>
          <StatusChip stage={app.stage} note={app.statusNote} />
        </div>

        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-sm text-ash">
              Reference{" "}
              <span className="font-medium text-bone">{app.id}</span>
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-bone sm:text-4xl">
              {app.title}
            </h1>
            <p className="mt-2 text-sm text-ash">{app.service}</p>
          </div>

          {/* the contour motif as a bounded site figure, not wallpaper */}
          <TopoPlate
            seed={Number(app.id.slice(-4)) || 7}
            peaks={[{ cx: 720, cy: 400, r0: 120, rings: 8, gap: 66 }]}
            caption={
              <>
                <span>Site</span>
                <span>{app.coords}</span>
              </>
            }
            className="hidden h-28 w-56 shrink-0 sm:block"
          />
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          <Meta k="Sector" v={app.sector} />
          <Meta k="Location" v={app.location} />
          <Meta k="Client" v={app.clientName} />
          <Meta k="AGV lead" v={app.lead} />
          <Meta k="Submitted" v={formatDate(app.submitted)} />
          <Meta k="Coordinates" v={app.coords} mono />
        </dl>
      </motion.header>

      {/* ——— progress ——— */}
      <motion.section {...enter(1)} aria-label="Progress" className="border-b border-ash/25 py-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            Progress
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-xs text-ash">
              Step {current + 1} of {PIPELINE.length}
            </span>
            {canEdit && (
              <label className="flex items-center gap-2">
                <span className="text-label font-semibold uppercase tracking-[0.12em] text-ash">
                  Change status
                </span>
                <select
                  value={app.stage}
                  onChange={onStageChange}
                  className="rounded-md border border-ash/30 bg-void/60 px-2.5 py-1.5 font-mono text-xs text-bone outline-none transition focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
                >
                  {PIPELINE.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="relative mt-9">
          <div aria-hidden className="absolute left-[10%] right-[10%] top-[13px] h-px bg-ash/25" />
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
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-ash/40 bg-void/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-ash/50" aria-hidden />
                    </span>
                  )}
                  <span
                    className={`px-1 text-label uppercase leading-tight tracking-[0.08em] ${
                      state === "done"
                        ? "text-contour"
                        : state === "current"
                          ? "text-amber font-semibold"
                          : "text-ash"
                    }`}
                  >
                    {stage.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="mt-8 max-w-prose text-sm leading-relaxed text-ash">
          {PIPELINE[current]?.description}
        </p>
      </motion.section>

      {/* ——— documents ——— */}
      <motion.section {...enter(2)} aria-label="Documents" className="border-b border-ash/25 py-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            Documents
          </h2>
          <span className="font-mono text-xs text-ash">
            {received} of {app.documents.length} received
          </span>
        </div>

        <ul className="mt-4 divide-y divide-ash/15 border-t border-ash/15">
          {app.documents.map((doc) => (
            <li key={doc.name} className="flex items-center gap-4 py-3.5">
              <FileBadge name={doc.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-bone">{doc.name}</p>
                <p className="mt-0.5 font-mono text-xs text-ash">
                  {doc.kind} · {doc.size} ·{" "}
                  {doc.uploaded ? formatDate(doc.uploaded) : "not received yet"}
                </p>
              </div>
              {doc.status === "received" ? (
                <button
                  type="button"
                  onClick={() => showToast("You can't open documents in this demo.")}
                  className="shrink-0 text-sm font-medium text-signal underline decoration-ash/40 decoration-1 underline-offset-4 transition hover:decoration-signal"
                >
                  View
                </button>
              ) : (
                <span className="shrink-0 rounded-full border border-amber/50 px-2.5 py-0.5 text-label uppercase tracking-[0.12em] text-amber">
                  Not received
                </span>
              )}
            </li>
          ))}
        </ul>
      </motion.section>

      {/* ——— activity ——— */}
      <motion.section {...enter(3)} aria-label="Activity" className="py-8">
        <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
          Activity
        </h2>

        <ol className="relative mt-5 max-w-prose">
          <span aria-hidden className="absolute bottom-1 left-[3px] top-1 w-px bg-ash/20" />
          {app.timeline.map((entry, i) => (
            <li key={`${entry.at}-${i}`} className="relative pb-6 pl-6 last:pb-0">
              <span
                aria-hidden
                className={`absolute left-0 top-1 h-[7px] w-[7px] rounded-full ${
                  entry.kind === "system" ? "bg-ash/50" : "bg-ash"
                }`}
              />
              <p className="font-mono text-xs text-ash">
                {formatDate(entry.at)} — {entry.actor}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-bone">{entry.text}</p>
            </li>
          ))}
        </ol>

        {canEdit && (
          <form onSubmit={onNoteSubmit} className="mt-6 max-w-prose border-t border-ash/15 pt-5">
            <label
              htmlFor="add-note"
              className="text-label font-semibold uppercase tracking-[0.12em] text-ash"
            >
              Add a note — saved as {actor}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="add-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Type your note"
                className="min-w-0 flex-1 rounded-md border border-ash/25 bg-void/60 px-3 py-2 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
              />
              <button
                type="submit"
                disabled={!note.trim()}
                className="shrink-0 rounded-md bg-signal px-4 py-2 font-display text-sm font-bold text-void transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save note
              </button>
            </div>
          </form>
        )}
      </motion.section>

      {/* ——— colophon ——— */}
      <footer className="mt-2 border-t-2 border-bone/80 pt-5">
        <p className="font-mono text-xs text-ash">
          {app.id} · Artea Green Ventures · Demo record, not an official document
        </p>
      </footer>

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
              className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ash/25 bg-pine px-5 py-2.5 shadow-[var(--shadow-pop)]"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber" />
              <span className="text-xs text-bone">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

function Meta({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-label font-semibold uppercase tracking-[0.14em] text-ash">{k}</dt>
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ash/25 bg-void/40 font-mono text-label tracking-[0.06em] text-ash"
    >
      {label}
    </span>
  );
}
