import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import UserPortalView from "@/components/UserPortalView";

export const metadata: Metadata = { title: "Your applications" };

// /portal is the signed-in user's gallery of the applications they can see
// (read-only). Admin edit controls live on /admin/applications/[id].
export default function PortalPage() {
  return (
    <AppShell expect="user">
      <UserPortalView />
    </AppShell>
  );
}
