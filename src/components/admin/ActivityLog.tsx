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
import { fetchAuditLog, type AuditLogEntry } from "@/lib/supabase/auditLog";
import { fetchLoginActivity, type LoginActivityEntry } from "@/lib/supabase/loginActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SimplePagination from "@/components/admin/SimplePagination";

const PAGE_SIZE = 5;

type Tab = "logins" | "activity";

function formatTimestamp(iso: string): string {
  const time = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso.slice(0, 10))} · ${time}`;
}

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export default function ActivityLog() {
  const [tab, setTab] = useState<Tab>("logins");
  const [logins, setLogins] = useState<LoadState<LoginActivityEntry[]>>({ status: "loading" });
  const [activity, setActivity] = useState<LoadState<AuditLogEntry[]>>({ status: "loading" });
  const [profiles, setProfiles] = useState<ProfileForRoleAssignment[]>([]);
  const [loginsPage, setLoginsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  useEffect(() => {
    fetchLoginActivity()
      .then((data) => setLogins({ status: "ready", data }))
      .catch((e) =>
        setLogins({ status: "error", message: e instanceof Error ? e.message : "Couldn't load sign-in activity." })
      );
    fetchAuditLog()
      .then((data) => setActivity({ status: "ready", data }))
      .catch((e) =>
        setActivity({ status: "error", message: e instanceof Error ? e.message : "Couldn't load activity." })
      );
    fetchAllProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
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
      className="glass flex h-full min-h-0 flex-col rounded-2xl p-6 backdrop-blur-xl sm:p-7"
    >
      <div className="shrink-0">
        <PeopleSectionHeading
          label="Activity log"
          description="Recent sign-in/sign-up activity and in-app changes. Read-only, most recent first."
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-5 h-full min-h-0">
        <TabsList variant="line" className="w-full shrink-0 justify-start border-b border-ash/20 bg-transparent p-0">
          <TabsTrigger value="logins" className="flex-none data-active:text-signal after:bg-signal">
            Sign-in / sign-up
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-none data-active:text-signal after:bg-signal">
            In-app activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logins" className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {logins.status === "loading" ? (
              <p role="status" className="mt-5 text-sm text-ash">Loading…</p>
            ) : logins.status === "error" ? (
              <p className="mt-5 text-sm text-amber">{logins.message}</p>
            ) : (
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
                {loginsData.length === 0 && <li className="py-2.5 text-sm text-ash">No accounts yet.</li>}
              </ul>
            )}
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
            {activity.status === "loading" ? (
              <p role="status" className="mt-5 text-sm text-ash">Loading…</p>
            ) : activity.status === "error" ? (
              <p className="mt-5 text-sm text-amber">{activity.message}</p>
            ) : (
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
                {activityData.length === 0 && <li className="py-2.5 text-sm text-ash">No activity yet.</li>}
              </ul>
            )}
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
