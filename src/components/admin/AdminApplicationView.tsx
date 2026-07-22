"use client";

// Admin detail view: the same ApplicationDetail the user portal uses, with
// edit controls enabled. Reads live data from the applications store so
// edits reflect here, in the gallery, and on the user portal.

import Link from "next/link";
import ApplicationDetail from "@/components/ApplicationDetail";
import { useApplications } from "@/lib/applications";

export default function AdminApplicationView({ id }: { id: string }) {
  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — fall through to the unknown state
  }
  const app = useApplications((s) =>
    s.applications.find((a) => a.id.toLowerCase() === clean.toLowerCase())
  );

  return (
    <>
      <Link
        href="/admin"
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash transition hover:text-signal"
      >
        ← Back to all applications
      </Link>

      {app ? (
        <div className="mt-8">
          <ApplicationDetail app={app} canEdit />
        </div>
      ) : (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            We couldn&apos;t find this application
          </h1>
          <p className="mt-2 text-sm text-ash">
            Nothing matches that reference number. Check the link, or go back to
            all applications.
          </p>
        </div>
      )}
    </>
  );
}
