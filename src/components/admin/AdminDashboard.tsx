"use client";

import { motion, useReducedMotion } from "framer-motion";
import StatStrip from "./StatStrip";
import PipelineFunnel from "./PipelineFunnel";
import SectorBars from "./SectorBars";
import ApplicationsTable from "./ApplicationsTable";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AdminDashboard() {
  const reduced = useReducedMotion();

  const enter = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay: i * 0.09, ease: EASE },
        };

  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-signal">
        Admin console
      </p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.02em] text-bone sm:text-5xl">
        Operations overview
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
        Every application across AU and PH — live pipeline counts, the
        cumulative funnel, and the full queue below.
      </p>

      <motion.div {...enter(0)} className="mt-10">
        <StatStrip />
      </motion.div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <motion.div {...enter(1)} className="lg:col-span-3">
          <PipelineFunnel />
        </motion.div>
        <motion.div {...enter(2)} className="lg:col-span-2">
          <SectorBars />
        </motion.div>
      </div>

      <motion.div {...enter(3)} className="mt-4">
        <ApplicationsTable />
      </motion.div>
    </>
  );
}
