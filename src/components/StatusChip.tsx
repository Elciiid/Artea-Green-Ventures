import { PIPELINE, TIER_OF_STAGE, type Stage, type Tier } from "@/lib/mock-data";

// Status colors follow the 3-tier semantics (neutral/active/resolved).
// Signal is reserved for interactive elements and never appears on badges.
export const TIER_TEXT: Record<Tier, string> = {
  neutral: "border-ash/40 text-ash",
  active: "border-amber/50 text-amber",
  resolved: "border-contour/50 text-contour",
};

export const TIER_DOT: Record<Tier, string> = {
  neutral: "bg-ash",
  active: "bg-amber",
  resolved: "bg-contour",
};

export default function StatusChip({ stage, note }: { stage: Stage; note?: string }) {
  const label = PIPELINE.find((s) => s.id === stage)?.label ?? stage;
  const tier = TIER_OF_STAGE[stage];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${TIER_TEXT[tier]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
      {note ? <span className="normal-case text-ash/80">· {note}</span> : null}
    </span>
  );
}
