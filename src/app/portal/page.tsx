import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import ApplicationDetail from "@/components/ApplicationDetail";
import TopoField from "@/components/TopoField";
import { applicationsForClient } from "@/lib/mock-data";
import { DEMO_ACCOUNTS } from "@/lib/session";

export const metadata: Metadata = { title: "Client portal" };

// The client has exactly one application, so /portal is its full detail
// view (read-only ApplicationDetail; admin edit controls arrive in Phase 4).
export default function PortalPage() {
  const app = applicationsForClient(DEMO_ACCOUNTS.client.email)[0];

  return (
    <AppShell expect="client">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-contour">
        Client portal — {DEMO_ACCOUNTS.client.org}
      </p>

      {app ? (
        <div className="mt-4">
          <ApplicationDetail app={app} />
        </div>
      ) : (
        <div className="relative mt-10 overflow-hidden rounded-xl border border-dashed border-ash/25 py-20 text-center">
          <TopoField
            className="opacity-30"
            seed={47}
            peaks={[{ cx: 720, cy: 450, r0: 55, rings: 5, gap: 44 }]}
          />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
              No active application
            </p>
            <p className="mt-2 text-sm text-ash/80">
              Your submissions will appear here once received.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
