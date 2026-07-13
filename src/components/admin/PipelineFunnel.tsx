"use client";

// True cumulative funnel: for each stage, how many applications have
// reached or passed it (stage-index comparison, not a tally of current
// stages). Bars wear tier status colors and are always direct-labeled.

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  APPLICATIONS,
  PIPELINE,
  TIER_OF_STAGE,
  stageIndex,
  type Tier,
} from "@/lib/mock-data";

const FILL: Record<Tier, string> = {
  neutral: "bg-ash/50",
  active: "bg-amber/70",
  resolved: "bg-contour/70",
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function PipelineFunnel() {
  const reduced = useReducedMotion();

  const rows = useMemo(() => {
    const total = APPLICATIONS.length;
    return PIPELINE.map((stage, i) => {
      const reached = APPLICATIONS.filter((a) => stageIndex(a.stage) >= i);
      return {
        ...stage,
        tier: TIER_OF_STAGE[stage.id],
        count: reached.length,
        pct: total ? Math.round((reached.length / total) * 100) : 0,
        names: reached.map((a) => a.title),
      };
    });
  }, []);

  return (
    <section
      aria-label="Cumulative pipeline funnel"
      className="h-full rounded-xl border border-ash/15 bg-pine p-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Pipeline — cumulative
        </h2>
        <p className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-ash/60 sm:block">
          Reached or passed each stage
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((row, i) => (
          <div
            key={row.id}
            tabIndex={0}
            className="group relative rounded-sm outline-offset-4"
            aria-label={`${row.label}: ${row.count} of ${APPLICATIONS.length} applications (${row.pct}%)${
              row.names.length ? ` — ${row.names.join(", ")}` : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
                {row.label}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-base font-black text-bone">{row.count}</span>
                <span className="font-mono text-[10px] text-ash/70">{row.pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-7 overflow-hidden rounded-md border border-ash/10 bg-void/60">
              <motion.div
                className={`h-full rounded-md ${FILL[row.tier]}`}
                initial={reduced ? false : { width: "0%" }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.09, ease: EASE }}
              />
            </div>

            {row.names.length > 0 && (
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-max max-w-full rounded-md border border-ash/20 bg-void px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] group-hover:block group-focus-visible:block">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ash">
                  At or past this stage
                </p>
                <ul className="mt-1 space-y-0.5">
                  {row.names.map((n) => (
                    <li key={n} className="text-[11px] text-bone">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
