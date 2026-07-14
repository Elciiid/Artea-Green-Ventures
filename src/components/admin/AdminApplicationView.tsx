"use client";

// Admin detail view: the same ApplicationDetail the client portal uses,
// with edit controls enabled. Reads live data from the applications store
// so edits reflect here, in the gallery, and on the client portal.

import Link from "next/link";
import ApplicationDetail from "@/components/ApplicationDetail";
import TopoField from "@/components/TopoField";
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
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash transition hover:text-signal"
      >
        ← All applications
      </Link>

      {app ? (
        <div className="mt-8">
          <ApplicationDetail app={app} canEdit />
        </div>
      ) : (
        <div className="relative mt-10 overflow-hidden rounded-xl border border-dashed border-ash/25 py-20 text-center">
          <TopoField
            className="opacity-30"
            seed={53}
            peaks={[{ cx: 720, cy: 450, r0: 55, rings: 5, gap: 44 }]}
          />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
              Unknown application
            </p>
            <p className="mt-2 text-sm text-ash/80">
              No case in the demo data matches this ID.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
