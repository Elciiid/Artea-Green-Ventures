import { PIPELINE, type Stage } from "@/lib/mock-data";

// Contour = approved/positive · Amber = in review/pending · Ash = neutral
const STYLES: Record<Stage, string> = {
  submitted: "border-ash/40 text-ash",
  "under-review": "border-amber/50 text-amber",
  "site-visit": "border-signal/50 text-signal",
  "report-issued": "border-contour/50 text-contour",
  closed: "border-ash/40 text-ash",
};

export default function StatusChip({ stage, note }: { stage: Stage; note?: string }) {
  const label = PIPELINE.find((s) => s.id === stage)?.label ?? stage;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${STYLES[stage]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
      {note ? <span className="normal-case text-ash/80">· {note}</span> : null}
    </span>
  );
}
