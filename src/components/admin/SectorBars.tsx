"use client";

// Applications by sector — a single series, so bars stay monochrome and
// identity lives in the row labels (not per-bar hues).

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { APPLICATIONS } from "@/lib/mock-data";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function SectorBars() {
  const reduced = useReducedMotion();

  const rows = useMemo(() => {
    const counts = new Map<string, { count: number; names: string[] }>();
    for (const a of APPLICATIONS) {
      const entry = counts.get(a.sector) ?? { count: 0, names: [] };
      entry.count += 1;
      entry.names.push(a.title);
      counts.set(a.sector, entry);
    }
    return [...counts.entries()]
      .map(([sector, v]) => ({
        sector,
        ...v,
        pct: APPLICATIONS.length ? Math.round((v.count / APPLICATIONS.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  return (
    <section
      aria-label="Applications by sector"
      className="flex h-full flex-col rounded-xl border border-ash/15 bg-pine p-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">By sector</h2>

      <div className="mt-5 flex-1 space-y-4">
        {rows.map((row, i) => (
          <div
            key={row.sector}
            tabIndex={0}
            className="group relative rounded-sm outline-offset-4"
            aria-label={`${row.sector}: ${row.count} of ${APPLICATIONS.length} (${row.pct}%) — ${row.names.join(", ")}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
                {row.sector}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-base font-black text-bone">{row.count}</span>
                <span className="font-mono text-[10px] text-ash/70">{row.pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-7 overflow-hidden rounded-md border border-ash/10 bg-void/60">
              <motion.div
                className="h-full rounded-md bg-bone/30"
                initial={reduced ? false : { width: "0%" }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.09, ease: EASE }}
              />
            </div>

            <div className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-max max-w-full rounded-md border border-ash/20 bg-void px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] group-hover:block group-focus-visible:block">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ash">{row.sector}</p>
              <ul className="mt-1 space-y-0.5">
                {row.names.map((n) => (
                  <li key={n} className="text-[11px] text-bone">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-ash/60">
        {APPLICATIONS.length} applications · {rows.length} sectors
      </p>
    </section>
  );
}
