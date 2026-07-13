"use client";

// All applications — client-side sort, tier/sector filters, name search.
// Built as an ARIA grid of motion rows so filtering/sorting reflows
// smoothly (real <tr> elements animate poorly). Designed to hold up at
// 50+ rows: virtualization isn't needed yet, but all derivations are
// memoized and keyed by stable ids.

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import StatusChip, { TIER_DOT } from "@/components/StatusChip";
import TopoField from "@/components/TopoField";
import { formatDate } from "@/lib/format";
import {
  APPLICATIONS,
  TIERS,
  TIER_OF_STAGE,
  stageIndex,
  type Application,
  type Tier,
} from "@/lib/mock-data";

const MotionRow = motion.create(Link);

type SortKey =
  | "title"
  | "sector"
  | "location"
  | "client"
  | "stage"
  | "lead"
  | "submitted";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Application" },
  { key: "sector", label: "Sector" },
  { key: "location", label: "Location" },
  { key: "client", label: "Client" },
  { key: "stage", label: "Status" },
  { key: "lead", label: "Lead" },
  { key: "submitted", label: "Submitted" },
];

const ACCESSOR: Record<SortKey, (a: Application) => string | number> = {
  title: (a) => a.title.toLowerCase(),
  sector: (a) => a.sector,
  location: (a) => a.location,
  client: (a) => a.clientName.toLowerCase(),
  stage: (a) => stageIndex(a.stage),
  lead: (a) => a.lead.toLowerCase(),
  submitted: (a) => a.submitted,
};

const GRID =
  "grid grid-cols-[minmax(230px,2.4fr)_minmax(120px,1fr)_minmax(105px,1fr)_minmax(150px,1.3fr)_minmax(140px,1.1fr)_minmax(80px,0.8fr)_minmax(105px,1fr)] items-center gap-x-4";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function ApplicationsTable() {
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"all" | Tier>("all");
  const [sector, setSector] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "submitted",
    dir: -1,
  });

  const sectors = useMemo(
    () => [...new Set(APPLICATIONS.map((a) => a.sector))],
    []
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = APPLICATIONS.filter((a) => {
      if (tier !== "all" && TIER_OF_STAGE[a.stage] !== tier) return false;
      if (sector !== "all" && a.sector !== sector) return false;
      if (
        q &&
        ![a.title, a.clientName, a.id].some((s) => s.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
    const acc = ACCESSOR[sort.key];
    return filtered.sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [query, tier, sector, sort]);

  const filtersActive = query.trim() !== "" || tier !== "all" || sector !== "all";

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: (prev.dir * -1) as 1 | -1 }
        : { key, dir: key === "submitted" ? -1 : 1 }
    );
  }

  function reset() {
    setQuery("");
    setTier("all");
    setSector("all");
  }

  return (
    <section aria-label="Applications" className="rounded-xl border border-ash/15 bg-pine">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
        <div>
          <h2 className="font-display text-lg font-extrabold tracking-[-0.01em] text-bone">
            Applications
          </h2>
          <p
            aria-live="polite"
            className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
          >
            {rows.length} of {APPLICATIONS.length} shown
          </p>
        </div>
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, client, or ID"
            aria-label="Search applications by name, client, or ID"
            className="w-72 max-w-full rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 pr-8 font-mono text-xs text-bone outline-none transition placeholder:text-ash/40 focus:border-signal/70 focus:ring-1 focus:ring-signal/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-1 font-mono text-sm text-ash transition hover:text-bone"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3 px-6 pb-5">
        <PillGroup
          label="Status"
          value={tier}
          onChange={(v) => setTier(v as "all" | Tier)}
          options={[
            { value: "all", label: "All" },
            ...TIERS.map((t) => ({ value: t.id, label: t.label, dot: TIER_DOT[t.id] })),
          ]}
        />
        <PillGroup
          label="Sector"
          value={sector}
          onChange={setSector}
          options={[
            { value: "all", label: "All" },
            ...sectors.map((s) => ({ value: s, label: s })),
          ]}
        />
        {filtersActive && (
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal transition hover:brightness-125"
          >
            Reset
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div role="table" aria-label="All applications" className="min-w-[1040px]">
          <div role="rowgroup">
            <div role="row" className={`${GRID} border-t border-ash/10 bg-void/30 px-6 py-2.5`}>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <div
                    key={col.key}
                    role="columnheader"
                    aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
                        active ? "text-signal" : "text-ash hover:text-bone"
                      }`}
                    >
                      {col.label}
                      <span
                        aria-hidden
                        className={active ? "" : "opacity-0 transition group-hover:opacity-60"}
                      >
                        {active ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div role="rowgroup">
            <AnimatePresence initial={false} mode="popLayout">
              {rows.map((app) => (
                <MotionRow
                  key={app.id}
                  href={`/admin/applications/${app.id}`}
                  role="row"
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: reduced ? 0 : -10,
                    transition: { duration: reduced ? 0 : 0.18 },
                  }}
                  transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
                  className={`${GRID} border-t border-ash/10 px-6 py-4 transition-colors hover:bg-void/40 focus-visible:bg-void/40`}
                >
                  <div role="cell" className="min-w-0">
                    <p className="truncate text-sm font-medium text-bone">{app.title}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] tracking-[0.08em] text-ash">
                      {app.id} · {app.service}
                    </p>
                  </div>
                  <div role="cell" className="truncate text-[13px] text-bone/85">
                    {app.sector}
                  </div>
                  <div role="cell" className="truncate text-[13px] text-bone/85">
                    {app.location}
                  </div>
                  <div role="cell" className="truncate text-[13px] text-bone/85">
                    {app.clientName}
                  </div>
                  <div role="cell">
                    <StatusChip stage={app.stage} />
                  </div>
                  <div role="cell" className="truncate font-mono text-xs text-bone/85">
                    {app.lead}
                  </div>
                  <div role="cell" className="font-mono text-xs text-ash">
                    {formatDate(app.submitted)}
                  </div>
                </MotionRow>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="relative overflow-hidden border-t border-ash/10 py-16 text-center">
          <TopoField
            className="opacity-30"
            seed={41}
            peaks={[{ cx: 720, cy: 450, r0: 55, rings: 5, gap: 44 }]}
          />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
              No applications match
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-3 rounded-full border border-signal/60 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-signal transition hover:bg-signal hover:text-void"
            >
              Reset filters
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-ash/10 px-6 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ash/60">
          Sorted by {COLUMNS.find((c) => c.key === sort.key)?.label} ·{" "}
          {sort.dir === 1 ? "ascending" : "descending"} · click a row for detail
        </p>
      </div>
    </section>
  );
}

type PillOption = { value: string; label: string; dot?: string };

function PillGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: PillOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ash/70">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Filter by ${label}`}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                active
                  ? "border-signal bg-signal text-void"
                  : "border-ash/25 text-ash hover:border-ash/50 hover:text-bone"
              }`}
            >
              {o.dot && (
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${active ? "bg-void/70" : o.dot}`}
                />
              )}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
