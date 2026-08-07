"use client";

// AGV Dashboard (/dashboard) — role-branched operational content, distinct
// from Home (/home). Moved here from /home as part of the artea-green-glow
// reskin's route split — see docs/superpowers/plans/2026-08-07-artea-green-
// glow-reskin.md.
//
// This is deliberately the ONLY place in the app that reads
// account.role/account.isCompanyManager to pick a dashboard body — every
// other file (AdminHomeDashboard, StaffHomeDashboard,
// ClientManagerHomeDashboard, ClientHomeDashboard) is unconditionally one
// role's content, not four independently-gated checks scattered around.
// AppShell's own `expect`/`requireCompanyManager` guards are a different,
// narrower thing — a route-level redirect for someone who shouldn't be on a
// page at all — and stay exactly as they are; this switch only decides
// which body renders for a role AppShell has already let through.

import { useSession } from "@/lib/session";
import AdminHomeDashboard from "@/components/home/AdminHomeDashboard";
import StaffHomeDashboard from "@/components/home/StaffHomeDashboard";
import ClientManagerHomeDashboard from "@/components/home/ClientManagerHomeDashboard";
import ClientHomeDashboard from "@/components/home/ClientHomeDashboard";

export default function Dashboard() {
  const account = useSession((s) => s.account);
  // AppShell already redirects to "/" before this ever mounts without a
  // session — this is just the brief instant before hydration, same as
  // every other surface that reads `account` directly.
  if (!account) return null;

  if (account.role === "admin") return <AdminHomeDashboard />;
  if (account.role === "staff") return <StaffHomeDashboard />;
  if (account.isCompanyManager) return <ClientManagerHomeDashboard />;
  return <ClientHomeDashboard />;
}
