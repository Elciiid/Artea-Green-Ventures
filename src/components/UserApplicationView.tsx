"use client";

// User-facing application detail: renders the shared ApplicationDetail
// read-only, but only if the signed-in user is allowed to see this
// application. Otherwise a plain "not available" state — a user can't
// reach an engagement outside their visible list by guessing the URL.

import Link from "next/link";
import ApplicationDetail from "@/components/ApplicationDetail";
import TopoField from "@/components/TopoField";
import { isApplicationVisible, useApplications } from "@/lib/applications";
import { useSession } from "@/lib/session";

export default function UserApplicationView({ id }: { id: string }) {
  const account = useSession((s) => s.account);
  const applications = useApplications((s) => s.applications);
  const users = useApplications((s) => s.users);

  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — falls through to the unavailable state
  }

  const app = applications.find(
    (a) => a.id.toLowerCase() === clean.toLowerCase()
  );
  const allowed = !!account && !!app && isApplicationVisible(account, app.id, users);

  return (
    <>
      <Link
        href="/portal"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash transition hover:text-signal"
      >
        ← My applications
      </Link>

      {allowed && app ? (
        <div className="mt-8">
          <ApplicationDetail app={app} />
        </div>
      ) : (
        <div className="relative mt-10 overflow-hidden rounded-xl border border-dashed border-ash/25 py-20 text-center">
          <TopoField
            className="opacity-30"
            seed={59}
            peaks={[{ cx: 720, cy: 450, r0: 55, rings: 5, gap: 44 }]}
          />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
              Not available
            </p>
            <p className="mt-2 text-sm text-ash/80">
              This application isn&apos;t part of your assigned engagements.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
