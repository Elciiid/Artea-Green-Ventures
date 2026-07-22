"use client";

// Visibility management: a matrix of grantable people (rows) × applications
// (columns). Phase 10b-3c — real grant/revoke against agv_application_access
// (lifecycle records: granted_at + nullable revoked_at, never deleted),
// replacing the earlier mock instant-toggle. Each click is now a real
// network write; the cell shows a pending state while it's in flight and an
// error toast if it fails, reverting to whatever the database actually
// holds rather than assuming the click succeeded.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import {
  fetchApplicationsForAccess,
  fetchGrantableProfiles,
  fetchLiveGrants,
  grantAccess,
  revokeAccess,
  type AccessApplication,
  type GrantableProfile,
  type LiveGrant,
} from "@/lib/supabase/access";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      applications: AccessApplication[];
      profiles: GrantableProfile[];
      grants: LiveGrant[];
    };

function grantKey(applicationId: string, profileId: string): string {
  return `${applicationId}:${profileId}`;
}

export default function AccessMatrix() {
  const reduced = useReducedMotionPref();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([fetchApplicationsForAccess(), fetchGrantableProfiles(), fetchLiveGrants()])
      .then(([applications, profiles, grants]) => {
        if (cancelled) return;
        setState({ status: "ready", applications, profiles, grants });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Something went wrong loading access.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(app: AccessApplication, profile: GrantableProfile) {
    if (state.status !== "ready") return;
    const key = grantKey(app.id, profile.id);
    if (pending.has(key)) return;

    const existing = state.grants.find(
      (g) => g.application_id === app.id && g.profile_id === profile.id
    );

    setPending((p) => new Set(p).add(key));
    try {
      if (existing) {
        await revokeAccess(existing.id);
      } else {
        await grantAccess(app.id, profile.id);
      }
      const grants = await fetchLiveGrants();
      setState((s) => (s.status === "ready" ? { ...s, grants } : s));
    } catch (e) {
      showToast(
        e instanceof Error
          ? `Couldn't update access: ${e.message}`
          : "Couldn't update access."
      );
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  const enter = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: EASE },
      };

  return (
    <>
      <div>
        <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
          Admin console
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
          User access
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
          Choose which applications each person can see. Check a box to grant
          access, uncheck it to revoke it. Changes save on their own and take
          effect right away.
        </p>
      </div>

      {state.status === "loading" ? (
        <div className="mt-9 border-y-2 border-bone/80 py-16 text-center">
          <p
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-3 text-sm text-ash"
          >
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
            />
            Loading access…
          </p>
        </div>
      ) : state.status === "error" ? (
        <div className="mt-9 border-y-2 border-bone/80 py-16 text-center">
          <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            We couldn&apos;t load access
          </h2>
          <p className="mt-2 text-sm text-ash">{state.message}</p>
        </div>
      ) : (
        <>
          <motion.section
            {...enter}
            aria-label="Application access by person"
            className="mt-9 overflow-x-auto border-y-2 border-bone/80"
          >
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-ash/30">
                  <th
                    scope="col"
                    className="w-64 px-4 py-3 pl-1 text-left text-label font-semibold uppercase tracking-[0.12em] text-ash"
                  >
                    Person
                  </th>
                  {state.applications.map((app) => (
                    <th key={app.id} scope="col" className="px-4 py-4 text-left align-bottom">
                      <span className="block font-mono text-label tracking-[0.1em] text-ash">
                        {app.reference}
                      </span>
                      <span className="mt-1 block max-w-[160px] text-[13px] font-medium leading-snug text-bone">
                        {app.title}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.profiles.map((profile) => {
                  const count = state.grants.filter((g) => g.profile_id === profile.id).length;
                  return (
                    <tr key={profile.id} className="border-b border-ash/15 last:border-b-0">
                      <th scope="row" className="py-5 pl-1 pr-4 text-left align-top">
                        <span className="block font-display text-sm font-bold text-bone">
                          {profile.name}
                        </span>
                        <span className="mt-1 inline-block rounded-full border border-ash/40 px-2.5 py-0.5 text-label uppercase tracking-[0.14em] text-ash">
                          {profile.role}
                        </span>
                        <span
                          aria-live="polite"
                          className="mt-1.5 block text-label uppercase tracking-[0.1em] text-ash"
                        >
                          Can see {count} of {state.applications.length}
                        </span>
                      </th>
                      {state.applications.map((app) => {
                        const key = grantKey(app.id, profile.id);
                        const checked = state.grants.some(
                          (g) => g.application_id === app.id && g.profile_id === profile.id
                        );
                        const busy = pending.has(key);
                        return (
                          <td key={app.id} className="px-4 py-5 align-top">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              aria-label={`${checked ? "Revoke" : "Grant"} ${profile.name}'s access to ${app.title}`}
                              disabled={busy}
                              onClick={() => handleToggle(app, profile)}
                              className={`flex h-6 w-6 items-center justify-center rounded-md border transition disabled:opacity-50 ${
                                checked
                                  ? "border-signal bg-signal text-void"
                                  : "border-ash/30 bg-void/40 text-transparent hover:border-ash/60"
                              }`}
                            >
                              <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
                                <path
                                  d="M2.5 6.5l2.5 2.5 4.5-5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.section>

          <p className="mt-3 text-xs text-ash">
            Administrators can always see every application.
          </p>
        </>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            role="alert"
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ash/25 bg-pine px-5 py-2.5 shadow-[var(--shadow-pop)]"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber" />
            <span className="text-xs text-bone">{toast}</span>
          </div>
        )}
      </div>
    </>
  );
}
