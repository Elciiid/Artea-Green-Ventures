import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import Dashboard from "@/components/home/Dashboard";

export const metadata: Metadata = { title: "AGV Dashboard" };

// Dashboard — per-role operational content, reached via the nav row's
// "Dashboard" item. Distinct from Home (/home, the logo's destination and
// post-login default — see roleHome() in src/lib/session.ts): this used to
// live at /home; moved here to match the reference repo's own route split
// (index.tsx marketing page vs. dashboard.tsx) — see
// docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md. AppShell's
// expect list is the same route guard every other role-gated page uses.
export default function DashboardPage() {
  return (
    <AppShell expect={["admin", "staff", "client"]}>
      <Dashboard />
    </AppShell>
  );
}
