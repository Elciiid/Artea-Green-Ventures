import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import Dashboard from "@/components/home/Dashboard";

export const metadata: Metadata = { title: "AGV Dashboard" };

// Dashboard — per-role operational content, reached via the nav row's
// "Dashboard" item. Distinct from Home (/home, the logo's destination and
// post-login default — see roleHome() in src/lib/session.ts): this used to
// live at /home; moved here to match the reference repo's own route split
// (index.tsx marketing page vs. dashboard.tsx) — see
// docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md.
//
// expect narrowed to admin + manager-client only (2026-08-08) — staff and a
// plain client no longer have a Dashboard at all (see Dashboard.tsx, and
// StaffHomeDashboard.tsx/ClientHomeDashboard.tsx's own deletion), so a bare
// landing on this route from either of those two now redirects them to
// their real home (/portal) exactly like any other role mismatch, instead
// of rendering nothing. Same `expect={["admin","client"]}
// requireCompanyManager` combination /home uses for the identical reason —
// see requireCompanyManager's own doc comment on AppShell.
export default function DashboardPage() {
  return (
    <AppShell expect={["admin", "client"]} requireCompanyManager>
      <Dashboard />
    </AppShell>
  );
}
