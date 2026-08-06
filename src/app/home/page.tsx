import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import HomeLanding from "@/components/home/HomeLanding";

export const metadata: Metadata = { title: "AGV Home" };

// Post-login default for every role (Phase 18 sent only admin/staff here;
// reversed for client per this task's own explicit requirement — see
// roleHome() in src/lib/session.ts). AppShell's expect list is the route
// guard that enforces who may land here, the same mechanism every other
// role-gated page in this app uses.
export default function HomePage() {
  return (
    <AppShell expect={["admin", "staff", "client"]} centerContent>
      <HomeLanding />
    </AppShell>
  );
}
