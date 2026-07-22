"use client";

// User-facing application detail: renders the shared ApplicationDetail
// read-only, but only if the signed-in user is allowed to see this
// application. Otherwise a plain "not available" state — a user can't
// reach an application outside their visible list by guessing the URL.

import Link from "next/link";
import ApplicationDetail from "@/components/ApplicationDetail";
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
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash transition hover:text-signal"
      >
        ← Back to your applications
      </Link>

      {allowed && app ? (
        <div className="mt-8">
          <ApplicationDetail app={app} />
        </div>
      ) : (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            You don&apos;t have access to this application
          </h1>
          <p className="mt-2 text-sm text-ash">
            It isn&apos;t one of your applications. Ask an administrator if you
            need access to it.
          </p>
        </div>
      )}
    </>
  );
}
