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

  return (
    <section aria-label="Activity log" className="glass mt-9 rounded-2xl p-6 backdrop-blur-xl sm:p-7">
      <h2 className="font-display text-lg font-bold text-bone">Activity log</h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ash">
        Recent sign-in/sign-up activity and in-app changes. Read-only, most recent first.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-5">
        <TabsList variant="line" className="w-full justify-start border-b border-ash/20 bg-transparent p-0">
          <TabsTrigger value="logins" className="data-active:text-signal after:bg-signal">
            Sign-in / sign-up
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-active:text-signal after:bg-signal">
            In-app activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logins">
          {logins.status === "loading" ? (
            <p role="status" className="mt-5 text-sm text-ash">Loading…</p>
          ) : logins.status === "error" ? (
            <p className="mt-5 text-sm text-amber">{logins.message}</p>
          ) : (
            <ul className="mt-5 divide-y divide-ash/15">
              {logins.data.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="font-medium text-bone">{entry.email}</span>
                  <span className="text-xs text-ash">
                    {entry.provider} · joined {formatTimestamp(entry.created_at)}
                    {entry.last_sign_in_at && <> · last signed in {formatTimestamp(entry.last_sign_in_at)}</>}
                  </span>
                </li>
              ))}
              {logins.data.length === 0 && <li className="py-2.5 text-sm text-ash">No accounts yet.</li>}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {activity.status === "loading" ? (
            <p role="status" className="mt-5 text-sm text-ash">Loading…</p>
          ) : activity.status === "error" ? (
            <p className="mt-5 text-sm text-amber">{activity.message}</p>
          ) : (
            <ul className="mt-5 divide-y divide-ash/15">
              {activity.data.map((entry) => (
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
              {activity.data.length === 0 && <li className="py-2.5 text-sm text-ash">No activity yet.</li>}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
