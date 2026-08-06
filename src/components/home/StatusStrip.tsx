// A row of per-stage counts, shared by the Staff and Client-manager
// dashboards (both need "a simple status strip — counts by stage" per the
// Dashboard brief). Reuses PIPELINE for the stage vocabulary and
// TIER_OF_STAGE/StatusChip's own tier color mapping rather than inventing a
// new palette — same neutral/active/resolved semantics as everywhere else
// in the app.

import { PIPELINE, TIER_OF_STAGE, type Stage } from "@/lib/mock-data";
import { TIER_DOT } from "@/components/StatusChip";

export default function StatusStrip({ counts }: { counts: Record<Stage, number> }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3">
      {PIPELINE.map((stage) => (
        <div key={stage.id} className="flex items-center gap-2">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TIER_DOT[TIER_OF_STAGE[stage.id]]}`} />
          <dt className="text-sm text-ash">{stage.label}</dt>
          <dd className="font-display text-sm font-bold text-bone">{counts[stage.id]}</dd>
        </div>
      ))}
    </dl>
  );
}
