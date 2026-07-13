"use client";

// Overview stat strip — all values computed from mock data, nothing hardcoded.

import { useMemo } from "react";
import KineticNumber from "./KineticNumber";
import { TIER_DOT } from "@/components/StatusChip";
import { APPLICATIONS, TIER_OF_STAGE, type Tier } from "@/lib/mock-data";

const DAY = 86_400_000;

type Cell = { label: string; value: number; dot?: string };

export default function StatStrip() {
  const cells = useMemo<Cell[]>(() => {
    const byTier: Record<Tier, number> = { neutral: 0, active: 0, resolved: 0 };
    for (const a of APPLICATIONS) byTier[TIER_OF_STAGE[a.stage]] += 1;

    const avgDays = APPLICATIONS.length
      ? Math.round(
          APPLICATIONS.reduce(
            (sum, a) =>
              sum + (Date.now() - new Date(a.submitted + "T00:00:00").getTime()) / DAY,
            0
          ) / APPLICATIONS.length
        )
      : 0;

    return [
      { label: "Total applications", value: APPLICATIONS.length },
      { label: "Neutral", value: byTier.neutral, dot: TIER_DOT.neutral },
      { label: "Active", value: byTier.active, dot: TIER_DOT.active },
      { label: "Resolved", value: byTier.resolved, dot: TIER_DOT.resolved },
      { label: "Avg days in pipeline", value: avgDays },
    ];
  }, []);

  return (
    <section
      aria-label="Pipeline overview"
      className="rounded-xl border border-ash/15 bg-pine px-6 py-6"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className="min-w-0 lg:border-l lg:border-ash/10 lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
          >
            <p className="font-display text-4xl font-black leading-none text-bone sm:text-5xl">
              <KineticNumber value={c.value} delay={i * 0.09} />
            </p>
            <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
              {c.dot ? (
                <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
              ) : null}
              <span className="truncate">{c.label}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
