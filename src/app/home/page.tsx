import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import Dashboard from "@/components/home/Dashboard";

export const metadata: Metadata = { title: "AGV Home" };

// Post-login default for every role (Phase 18 sent only admin/staff here;
// reversed for client per this task's own explicit requirement — see
// roleHome() in src/lib/session.ts). AppShell's expect list is the route
// guard that enforces who may land here, the same mechanism every other
// role-gated page in this app uses.
//
// centerContent dropped: that prop vertically centers short content, which
// was right for the old single-hero HomeLanding but is exactly the
// "excessive vertical spacing" bug this codebase has hit before once real
// dashboard content with several sections replaced a lone hero — see
// AppShell's own doc comment for centerContent's intended scope.
export default function HomePage() {
  return (
    <AppShell expect={["admin", "staff", "client"]}>
      <Dashboard />
    </AppShell>
  );
}
