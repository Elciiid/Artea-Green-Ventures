"use client";

// AGV Dashboard (/dashboard) — role-branched operational content, distinct
// from Home (/home). Moved here from /home as part of the artea-green-glow
// reskin's route split — see docs/superpowers/plans/2026-08-07-artea-green-
// glow-reskin.md.
//
// Only two bodies exist now (2026-08-08): staff and a plain client no
// longer have a Dashboard at all — see StaffHomeDashboard.tsx/
// ClientHomeDashboard.tsx's own deletion — and this route's own AppShell
// gate (`expect={["admin","client"]} requireCompanyManager`, see
// app/dashboard/page.tsx) already guarantees nobody else ever reaches this
// component, so there is no third "else" branch to fall through to. This
// stays the ONLY place in the app that reads account.role/
// account.isCompanyManager to pick a dashboard body — AdminHomeDashboard
// and ClientManagerHomeDashboard are each unconditionally one role's
// content, not independently-gated checks scattered around.

import { useSession } from "@/lib/session";
import AdminHomeDashboard from "@/components/home/AdminHomeDashboard";
import ClientManagerHomeDashboard from "@/components/home/ClientManagerHomeDashboard";

export default function Dashboard() {
  const account = useSession((s) => s.account);
  // AppShell already redirects to "/" before this ever mounts without a
  // session — this is just the brief instant before hydration, same as
  // every other surface that reads `account` directly.
  if (!account) return null;

  if (account.role === "admin") return <AdminHomeDashboard />;
  return <ClientManagerHomeDashboard />;
}
