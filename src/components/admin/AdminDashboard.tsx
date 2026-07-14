"use client";

// /admin is a navigation gallery, not a BI tool: one large card per
// application, straight through to its detail page.
//
// The Phase 2 analytics (StatStrip, PipelineFunnel, SectorBars) and the
// sortable ApplicationsTable are intentionally NOT rendered anymore — the
// components are retained in src/components/admin/ in case an opt-in
// "Insights" view is wanted later.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import StatusChip from "@/components/StatusChip";
import TopoField from "@/components/TopoField";
import { useApplications } from "@/lib/applications";
import { formatDate } from "@/lib/format";

const MotionLink = motion.create(Link);

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AdminDashboard() {
  const reduced = useReducedMotion();
  const applications = useApplications((s) => s.applications);

  const enter = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay: i * 0.1, ease: EASE },
        };

  return (
    <>
      <motion.div {...enter(0)}>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-signal">
          Admin console
        </p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.02em] text-bone sm:text-5xl">
          Applications
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
          {applications.length} active engagements across AU and PH — open one
          to review its status, documents and activity.
        </p>
      </motion.div>

      <div className="mt-10 space-y-4">
        {applications.map((app, i) => (
          <MotionLink
            key={app.id}
            href={`/admin/applications/${app.id}`}
            {...enter(i + 1)}
            className="group relative block overflow-hidden rounded-xl border border-ash/15 bg-pine p-6 transition-colors hover:border-signal/40 sm:p-8"
          >
            {/* each site gets its own terrain, seeded from the case id */}
            <TopoField
              className="opacity-40 transition-opacity duration-500 [mask-image:linear-gradient(to_left,black_15%,transparent_70%)] group-hover:opacity-75"
              seed={Number(app.id.slice(-4)) || 7}
              peaks={[{ cx: 1180, cy: 400 + i * 90, r0: 60, rings: 6, gap: 44 }]}
            />

            <div className="relative flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[11px] tracking-[0.14em] text-ash">
                  {app.id}
                </span>
                <StatusChip stage={app.stage} note={app.statusNote} />
              </div>

              <div>
                <h2 className="max-w-2xl font-display text-2xl font-black tracking-[-0.02em] text-bone sm:text-3xl">
                  {app.title}
                </h2>
                <p className="mt-1.5 text-sm text-ash">{app.service}</p>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ash">
                <span className="rounded-full border border-ash/25 px-2.5 py-0.5">
                  {app.sector}
                </span>
                <span>{app.location}</span>
                <span>Lead · {app.lead}</span>
                <span>Submitted · {formatDate(app.submitted)}</span>
                <span className="hidden normal-case tracking-normal text-ash/50 lg:inline">
                  {app.coords}
                </span>
                <span
                  aria-hidden
                  className="ml-auto text-base leading-none text-ash transition group-hover:translate-x-1 group-hover:text-signal"
                >
                  →
                </span>
              </div>
            </div>
          </MotionLink>
        ))}
      </div>
    </>
  );
}
