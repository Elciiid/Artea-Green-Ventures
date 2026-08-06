import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import MyTeam from "@/components/MyTeam";

export const metadata: Metadata = { title: "My Team" };

// /portal/team — a client-manager's own grant/revoke page. Gated on
// isCompanyManager (via requireCompanyManager below), not just role ===
// "client": a regular client hitting this route directly must be redirected
// away exactly like a role mismatch, not shown an empty/broken surface.
export default function MyTeamPage() {
  return (
    <AppShell expect="client" requireCompanyManager boundedContent>
      <MyTeam />
    </AppShell>
  );
}
