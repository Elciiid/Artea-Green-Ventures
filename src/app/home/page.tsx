import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import HomeLanding from "@/components/home/HomeLanding";

export const metadata: Metadata = { title: "AGV Home" };

// Home — the app's own landing/orientation page, reached via the logo
// (top-left) and the post-login default for every role (roleHome() in
// src/lib/session.ts). Distinct from Dashboard (/dashboard, in the nav
// row), matching the reference repo's own route split — see
// docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md.
// fullBleed: Hero needs genuine full-viewport width, not AppShell's normal
// max-w-6xl content column. heroHeader/hideFooter: matches the reference's
// SiteHeader/SiteFooter treatment of its own marketing page — see
// AppShell's own doc comments on each prop.
export default function HomePage() {
  return (
    <AppShell expect={["admin", "staff", "client"]} fullBleed heroHeader hideFooter>
      <HomeLanding />
    </AppShell>
  );
}
