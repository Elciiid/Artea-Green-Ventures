"use client";

// Client-side portal content: reads the client's application from the
// reactive store (so admin edits show up here too) and renders the shared
// detail view read-only — no canEdit, ever, for the client account.

import ApplicationDetail from "@/components/ApplicationDetail";
import TopoField from "@/components/TopoField";
import { useApplications } from "@/lib/applications";
import { DEMO_ACCOUNTS } from "@/lib/session";

export default function ClientPortalView() {
  const app = useApplications((s) =>
    s.applications.find(
      (a) => a.clientAccountEmail === DEMO_ACCOUNTS.client.email
    )
  );

  return app ? (
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
  );
}
