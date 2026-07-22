import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import UserPortalView from "@/components/UserPortalView";
import { PORTAL_ROLES } from "@/lib/session";

export const metadata: Metadata = { title: "Your applications" };

// /portal is the signed-in user's gallery of the applications they can see
// (read-only). Admin edit controls live on /admin/applications/[id].
export default function PortalPage() {
  return (
    <AppShell expect={PORTAL_ROLES}>
      <UserPortalView />
    </AppShell>
  );
}
