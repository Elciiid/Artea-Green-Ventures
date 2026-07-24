"use client";

// The applications register — a real semantic, sortable table, shared by the
// admin console and the user portal. This replaces the Phase 4 editorial card
// gallery (a deliberate reversal for the Phase 16 institutional register): a
// ruled register reads far more official than editorial cards, and leads with
// the reference number as the primary identifier.
//
// (The Phase 2 ApplicationsTable was evaluated for reuse but is product-shaped
// — search box, pill filters, motion rows, dark-only surfaces, static data,
// title-first. A purpose-built register was cleaner than retrofitting it.)

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import StatusChip from "@/components/StatusChip";
import { formatDate } from "@/lib/format";
import { stageIndex, type Application } from "@/lib/mock-data";

type SortKey = "id" | "title" | "sector" | "location" | "stage" | "lead" | "submitted";

const COLUMNS: { key: SortKey; label: string; mono?: boolean }[] = [
  { key: "id", label: "Reference", mono: true },
  { key: "title", label: "Application" },
  { key: "sector", label: "Sector" },
  { key: "location", label: "Location" },
  { key: "stage", label: "Status" },
  { key: "lead", label: "Lead" },
  { key: "submitted", label: "Submitted", mono: true },
];

const ACCESSOR: Record<SortKey, (a: Application) => string | number> = {
  id: (a) => a.id,
  title: (a) => a.title.toLowerCase(),
  sector: (a) => a.sector,
  location: (a) => a.location,
  stage: (a) => stageIndex(a.stage),
  lead: (a) => a.lead.toLowerCase(),
  submitted: (a) => a.submitted,
};

export default function ApplicationRegister({
  eyebrow,
  title,
  intro,
  applications,
  hrefBase,
  emptyState,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  applications: Application[];
  /** e.g. "/admin/applications" or "/portal/applications" */
  hrefBase: string;
  emptyState?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "id",
    dir: 1,
  });

  const rows = useMemo(() => {
    const acc = ACCESSOR[sort.key];
    return [...applications].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [applications, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: 1 }
    );
  }

  return (
    <div>
      <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ash">{intro}</p>

      {applications.length === 0 ? (
        <div className="mt-10">{emptyState}</div>
      ) : (
        <div className="glass mt-9 overflow-x-auto rounded-2xl p-2 backdrop-blur-xl">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-ash/30">
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={
                        active ? (sort.dir === 1 ? "ascending" : "descending") : "none"
                      }
                      className="px-4 py-3 first:pl-1 last:pr-1"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`group inline-flex items-center gap-1.5 text-label font-semibold uppercase tracking-[0.12em] transition ${
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
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((app) => (
                <tr
                  key={app.id}
                  className="border-b border-ash/15 last:border-b-0 transition-colors hover:bg-bone/[0.04]"
                >
                  <th scope="row" className="whitespace-nowrap py-3.5 pl-1 pr-4 align-top">
                    <Link
                      href={`${hrefBase}/${app.id}`}
                      className="rounded font-mono text-sm font-medium text-bone underline decoration-ash/40 decoration-1 underline-offset-4 transition hover:decoration-signal focus-visible:text-signal"
                    >
                      {app.id}
                    </Link>
                  </th>
                  <td className="max-w-[280px] py-3.5 pr-4 align-top">
                    <span className="block truncate text-sm font-medium text-bone">
                      {app.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ash">
                      {app.service}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 align-top text-sm text-bone">{app.sector}</td>
                  <td className="py-3.5 pr-4 align-top text-sm text-bone">{app.location}</td>
                  <td className="py-3.5 pr-4 align-top">
                    <StatusChip stage={app.stage} />
                  </td>
                  <td className="py-3.5 pr-4 align-top text-sm text-bone">{app.lead}</td>
                  <td className="whitespace-nowrap py-3.5 pr-1 align-top font-mono text-xs text-ash">
                    {formatDate(app.submitted)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {applications.length > 0 && (
        <p className="mt-3 text-xs text-ash">
          {applications.length}{" "}
          {applications.length === 1 ? "application" : "applications"} · select a
          reference number to open it
        </p>
      )}
    </div>
  );
}
