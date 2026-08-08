import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import HomeLanding from "@/components/home/HomeLanding";

export const metadata: Metadata = { title: "AGV Home" };

// Home — the app's own landing/orientation page, reached via the logo
// (top-left) and the post-login default for admin and a company-managing
// client (roleHome() in src/lib/session.ts). Distinct from Dashboard
// (/dashboard, in the nav row), matching the reference repo's own route
// split — see docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md.
//
// expect + requireCompanyManager narrowed (2026-08-08) from every role to
// admin/manager-client only, matching roleHome()'s own narrowing: staff and
// a plain client's real home is /portal now, not here, so a bare landing on
// this route (not just the logo/post-login redirect, which already stopped
// pointing here for them) bounces them the same way any other role
// mismatch does — see requireCompanyManager's own doc comment on AppShell
// for why "admin, always; client, only if managing" is exactly what
// `expect={["admin","client"]} requireCompanyManager` means here.
//
// fullBleed: Hero needs genuine full-viewport width, not AppShell's normal
// max-w-6xl content column. heroHeader/hideFooter: matches the reference's
// SiteHeader/SiteFooter treatment of its own marketing page — see
// AppShell's own doc comments on each prop.
export default function HomePage() {
  return (
    <AppShell expect={["admin", "client"]} requireCompanyManager fullBleed heroHeader hideFooter>
      <HomeLanding />
    </AppShell>
  );
}
