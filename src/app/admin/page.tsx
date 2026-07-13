import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import TopoField from "@/components/TopoField";
import { APPLICATIONS } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Admin console" };

// Placeholder dashboard — the applications table, filters and analytics
// are Phase 2. Counts below are read live from mock data.
export default function AdminPage() {
  const total = APPLICATIONS.length;
  const pendingDocs = APPLICATIONS.filter(
    (a) => a.statusNote === "Pending documents"
  ).length;
  const issued = APPLICATIONS.filter((a) => a.stage === "report-issued").length;

  return (
    <AppShell expect="admin">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-signal">
        Admin console
      </p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.02em] text-bone sm:text-5xl">
        Operations overview
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
        Every application across AU and PH, in one queue. The full table,
        filters and analytics land in Phase 2 — pipeline counts below are live
        from mock data.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat value={total} label="Applications in pipeline" />
        <Stat value={pendingDocs} label="Pending documents" />
        <Stat value={issued} label="Reports issued" />
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-dashed border-ash/25">
        <TopoField
          className="opacity-40"
          seed={23}
          peaks={[{ cx: 720, cy: 470, r0: 70, rings: 6, gap: 48 }]}
        />
        <div className="relative flex min-h-56 items-center justify-center p-10">
          <p className="text-center font-mono text-[11px] uppercase leading-loose tracking-[0.2em] text-ash">
            Applications table · status controls · analytics
            <br />
            <span className="text-amber">arrives in Phase 2</span>
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-ash/15 bg-pine p-6">
      <p className="font-display text-5xl font-black text-bone">{value}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ash">
        {label}
      </p>
    </div>
  );
}
