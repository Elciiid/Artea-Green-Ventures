"use client";

// The portal home for a normal user: a gallery of only the applications
// they've been granted access to (admins never reach /portal — the shell
// routes them to /admin). Reuses the shared ApplicationGallery.

import ApplicationGallery from "@/components/ApplicationGallery";
import TopoField from "@/components/TopoField";
import {
  useApplications,
  visibleApplicationsFor,
} from "@/lib/applications";
import { useSession } from "@/lib/session";

export default function UserPortalView() {
  const account = useSession((s) => s.account);
  const applications = useApplications((s) => s.applications);
  const users = useApplications((s) => s.users);

  if (!account) return null;

  const mine = visibleApplicationsFor(account, applications, users);

  return (
    <ApplicationGallery
      eyebrow="My engagements"
      eyebrowClass="text-contour"
      title="My applications"
      subtitle={`${mine.length} engagement${mine.length === 1 ? "" : "s"} assigned to you — open one to review its status, documents and activity.`}
      applications={mine}
      hrefBase="/portal/applications"
      emptyState={
        <div className="relative overflow-hidden rounded-xl border border-dashed border-ash/25 py-20 text-center">
          <TopoField
            className="opacity-30"
            seed={47}
            peaks={[{ cx: 720, cy: 450, r0: 55, rings: 5, gap: 44 }]}
          />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
              No engagements assigned
            </p>
            <p className="mt-2 text-sm text-ash/80">
              An administrator hasn&apos;t granted you access to any applications yet.
            </p>
          </div>
        </div>
      }
    />
  );
}
