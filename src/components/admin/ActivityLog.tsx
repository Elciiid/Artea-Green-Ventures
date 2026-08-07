"use client";

// Bare-bones, read-only, two-tab activity log. No filters, no search, no
// pagination — a stretch item for the July 31 pass, explicitly scoped down
// (see STATUS.md). Tab 2 (in-app activity) really is backend-already-exists,
// UI-only, per agv_audit_log. Tab 1 (sign-in/sign-up) is NOT — see
// src/app/api/admin/activity/logins/route.ts's file header for why that
// premise didn't fully hold and what was added to make it work anyway.

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { fetchAllProfiles, type ProfileForRoleAssignment } from "@/lib/supabase/roles";
import { fetchAuditLog } from "@/lib/supabase/auditLog";
import { fetchLoginActivity } from "@/lib/supabase/loginActivity";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 10;

type Tab = "logins" | "activity";

function formatTimestamp(iso: string): string {
  const time = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso.slice(0, 10))} · ${time}`;
}

export default function ActivityLog() {
  const [tab, setTab] = useState<Tab>("logins");
  // The two tabs are independent resources, not two views of one fetch —
  // either can fail on its own, and each keeps its own state accordingly.
  const { state: logins } = useAsyncResource(
    fetchLoginActivity,
    [],
    "Couldn't load sign-in activity."
  );
  const { state: activity } = useAsyncResource(fetchAuditLog, [], "Couldn't load activity.");
  const [loginsPage, setLoginsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  // Profiles are auxiliary: they only resolve an audit entry's actor UUID to a
  // display name. A failure here isn't fatal to the tab, so it stays plain
  // local state rather than going through useAsyncResource/SurfaceState — but
  // it must not be silent either. Without the notice below, a failed fetch is
  // indistinguishable from "these actors genuinely have no profile row", since
  // both fall through actorName()'s raw-UUID fallback.
  const [profiles, setProfiles] = useState<ProfileForRoleAssignment[]>([]);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllProfiles()
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch(() => {
        if (cancelled) return;
        setProfiles([]);
        setProfilesError("Couldn't load names — showing raw IDs.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function actorName(actor: string | null): string {
    if (!actor) return "System";
    return profiles.find((p) => p.id === actor)?.name ?? actor;
  }

  const loginsData = logins.status === "ready" ? logins.data : [];
  const loginsTotalPages = Math.max(1, Math.ceil(loginsData.length / PAGE_SIZE));
  const loginsCurrentPage = Math.min(loginsPage, loginsTotalPages);
  const pagedLogins = loginsData.slice(
    (loginsCurrentPage - 1) * PAGE_SIZE,
    loginsCurrentPage * PAGE_SIZE
  );

  const activityData = activity.status === "ready" ? activity.data : [];
  const activityTotalPages = Math.max(1, Math.ceil(activityData.length / PAGE_SIZE));
  const activityCurrentPage = Math.min(activityPage, activityTotalPages);
  const pagedActivity = activityData.slice(
    (activityCurrentPage - 1) * PAGE_SIZE,
    activityCurrentPage * PAGE_SIZE
  );

  return (
    <section
      aria-label="Activity log"
      className="flex h-full min-h-0 flex-col rounded-sm border border-ash/20 bg-pine p-6 shadow-panel sm:p-7"
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="flex h-full min-h-0 flex-col"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <PeopleSectionHeading
            label="Activity log"
            description="Recent sign-in/sign-up activity and in-app changes. Read-only, most recent first."
          />

          <TabsList className="w-fit gap-1 rounded-full border border-ash/20 bg-void/50 p-1">
            <TabsTrigger
              value="logins"
              className="rounded-full px-3 py-1 text-xs font-medium data-active:bg-signal data-active:text-void data-active:shadow-none"
            >
              Sign-in / sign-up
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-full px-3 py-1 text-xs font-medium data-active:bg-signal data-active:text-void data-active:shadow-none"
            >
              In-app activity
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="logins" className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SurfaceState
              loading={logins.status === "loading"}
              loadingLabel="Loading…"
              error={logins.status === "error" ? logins.message : null}
              empty={logins.status === "ready" && loginsData.length === 0}
              emptyContent={<p className="text-sm text-ash">No accounts yet.</p>}
              className="mt-5"
            >
              <ul className="mt-5 divide-y divide-ash/15">
                {pagedLogins.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                    <span className="font-medium text-bone">{entry.email}</span>
                    <span className="text-xs text-ash">
                      {entry.provider} · joined {formatTimestamp(entry.created_at)}
                      {entry.last_sign_in_at && <> · last signed in {formatTimestamp(entry.last_sign_in_at)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            </SurfaceState>
          </div>
          {logins.status === "ready" && (
            <div className="mt-3 shrink-0">
              <SimplePagination
                page={loginsCurrentPage}
                totalPages={loginsTotalPages}
                onPageChange={setLoginsPage}
                label="sign-in activity"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SurfaceState
              loading={activity.status === "loading"}
              loadingLabel="Loading…"
              error={activity.status === "error" ? activity.message : null}
              empty={activity.status === "ready" && activityData.length === 0}
              emptyContent={<p className="text-sm text-ash">No activity yet.</p>}
              className="mt-5"
            >
              <>
                {profilesError && (
                  <p role="alert" className="mt-5 text-sm text-amber">
                    {profilesError}
                  </p>
                )}
                <ul className="mt-5 divide-y divide-ash/15">
                  {pagedActivity.map((entry) => (
                    <li key={entry.id} className="py-2.5 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-medium text-bone">
                          {actorName(entry.actor)} · {entry.action.toLowerCase()} on {entry.table_name}
                        </span>
                        <span className="text-xs text-ash">{formatTimestamp(entry.at)}</span>
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-ash hover:text-bone">Details</summary>
                        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-void/40 p-3 text-xs text-ash">
                          {JSON.stringify(entry.changes, null, 2)}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              </>
            </SurfaceState>
          </div>
          {activity.status === "ready" && (
            <div className="mt-3 shrink-0">
              <SimplePagination
                page={activityCurrentPage}
                totalPages={activityTotalPages}
                onPageChange={setActivityPage}
                label="in-app activity"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
