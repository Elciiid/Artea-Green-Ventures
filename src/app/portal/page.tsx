import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import ClientPortalView from "@/components/ClientPortalView";
import { DEMO_ACCOUNTS } from "@/lib/session";

export const metadata: Metadata = { title: "Client portal" };

// The client has exactly one application, so /portal is its full detail
// view — read-only (admin edit controls live on /admin/applications/[id]).
export default function PortalPage() {
  return (
    <AppShell expect="client">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-contour">
        Client portal — {DEMO_ACCOUNTS.client.org}
      </p>
      <ClientPortalView />
    </AppShell>
  );
}
