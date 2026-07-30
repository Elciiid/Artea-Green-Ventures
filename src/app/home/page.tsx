import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import HomeLanding from "@/components/home/HomeLanding";

export const metadata: Metadata = { title: "AGV Home" };

// Post-login default for admin/staff (Phase 18). Client's default stays
// /portal — AppShell's expect list is the route guard that enforces that,
// the same mechanism every other role-gated page in this app uses.
export default function HomePage() {
  return (
    <AppShell expect={["admin", "staff"]} centerContent>
      <HomeLanding />
    </AppShell>
  );
}
