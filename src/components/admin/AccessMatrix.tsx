"use client";

// Visibility management — expandable rows: each row collapses to
// avatar/name/role/summary-chip, expanding on click to reveal the person's
// per-application checkboxes inline. Replaces the earlier person ×
// application checkbox grid/Table (see git history) to reduce felt row
// density and scale without adding a table column per application. The
// previous pass's sticky-column-header CSS fix doesn't apply here — there's
// no header row of per-application columns left to pin — and was removed
// along with the Table it belonged to.

import { useState } from "react";
import { toast } from "sonner";
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
import { useAsyncResource } from "@/lib/useAsyncResource";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 5;

function loadAccess(): Promise<{
  applications: AccessApplication[];
  profiles: GrantableProfile[];
  grants: LiveGrant[];
}> {
  return Promise.all([
    fetchApplicationsForAccess(),
    fetchGrantableProfiles(),
    fetchLiveGrants(),
  ]).then(([applications, profiles, grants]) => ({ applications, profiles, grants }));
}

function grantKey(applicationId: string, profileId: string): string {
  return `${applicationId}:${profileId}`;
}

export default function AccessMatrix() {
  const { state } = useAsyncResource(loadAccess, [], "Something went wrong loading access.");
  // Toggling a checkbox re-reads only the live grants — a narrower operation
  // than the initial load, so it keeps its own state rather than reloading the
  // whole surface (which would flash the spinner over every row).
  const [toggledGrants, setToggledGrants] = useState<LiveGrant[] | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const applications = state.status === "ready" ? state.data.applications : [];
  const allProfiles = state.status === "ready" ? state.data.profiles : [];
  const grants = toggledGrants ?? (state.status === "ready" ? state.data.grants : []);

  async function handleToggle(app: AccessApplication, profile: GrantableProfile) {
    if (state.status !== "ready") return;
    const key = grantKey(app.id, profile.id);
    if (pending.has(key)) return;

    const existing = grants.find(
      (g) => g.application_id === app.id && g.profile_id === profile.id
    );

    setPending((p) => new Set(p).add(key));
    try {
      if (existing) {
        await revokeAccess(existing.id);
      } else {
        await grantAccess(app.id, profile.id);
      }
      setToggledGrants(await fetchLiveGrants());
    } catch (e) {
      toast.error(
        e instanceof Error ? `Couldn't update access: ${e.message}` : "Couldn't update access."
      );
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  const filteredProfiles = allProfiles.filter((p) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProfiles = filteredProfiles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function onFilterChange(value: string) {
    setFilter(value);
    setPage(1);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <PeopleSectionHeading
          label="Access matrix"
          description="Choose which applications each person can see. Click a person to expand their applications, then check a box to grant or revoke access."
        />
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading access…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load access"
        // The two empty cases (nobody at all vs. nobody matching the filter)
        // are handled below, inside the scroll region, so the filter input
        // stays on screen and a filter that matches nothing can be cleared.
        empty={false}
        emptyContent={null}
        className="glass mt-9 rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        <>
          <div className="mt-9 shrink-0">
            <Input
              type="search"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter by name or role…"
              aria-label="Filter people by name or role"
              className="max-w-sm border-ash/25 bg-void/40 text-bone"
            />
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <SurfaceState
              loading={false}
              loadingLabel=""
              error={null}
              empty={pagedProfiles.length === 0}
              // Two distinct conditions that used to be conflated: an empty
              // *unfiltered* list rendered the filter message with an empty
              // filter in it — literally `No one matches "".` on a fresh
              // deployment, which reads as nonsense.
              emptyContent={
                allProfiles.length === 0 ? (
                  <>No one to grant access to yet.</>
                ) : (
                  <>No one matches &quot;{filter}&quot;.</>
                )
              }
              className="glass rounded-2xl py-8 text-center text-sm text-ash backdrop-blur-xl"
            >
              <ul className="flex flex-col gap-2">
                {pagedProfiles.map((profile) => {
                  const count = grants.filter((g) => g.profile_id === profile.id).length;
                  const isOpen = expandedId === profile.id;
                  return (
                    <li key={profile.id} className="glass rounded-2xl backdrop-blur-xl">
                      <Collapsible
                        open={isOpen}
                        onOpenChange={(open) => setExpandedId(open ? profile.id : null)}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${profile.name}, ${profile.role}, ${count} of ${applications.length} applications`}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal/15 text-sm font-bold text-signal">
                                {profile.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-display text-sm font-bold text-bone">
                                  {profile.name}
                                </span>
                                <span className="mt-0.5 inline-block rounded-full border border-ash/40 px-2 py-0.5 text-label uppercase tracking-[0.1em] text-ash">
                                  {profile.role}
                                </span>
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <span aria-live="polite" className="text-label uppercase tracking-[0.1em] text-ash">
                                {count} of {applications.length} apps
                              </span>
                              <svg
                                aria-hidden
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              >
                                <path d="m6 9 6 6 6-6" />
                              </svg>
                            </span>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="flex flex-col gap-1 border-t border-ash/15 px-4 py-3">
                            {applications.map((app) => {
                              const key = grantKey(app.id, profile.id);
                              const checked = grants.some(
                                (g) => g.application_id === app.id && g.profile_id === profile.id
                              );
                              const busy = pending.has(key);
                              return (
                                <li key={app.id} className="flex items-center justify-between gap-3 py-1.5">
                                  <span className="min-w-0 text-sm">
                                    <span className="block font-mono text-label tracking-[0.1em] text-ash">
                                      {app.reference}
                                    </span>
                                    <span className="block truncate text-bone">{app.title}</span>
                                  </span>
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={checked}
                                    aria-label={`${checked ? "Revoke" : "Grant"} ${profile.name}'s access to ${app.title}`}
                                    disabled={busy}
                                    onClick={() => handleToggle(app, profile)}
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 ${
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
                                </li>
                              );
                            })}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  );
                })}
              </ul>
            </SurfaceState>
          </div>

          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ash">
              Administrators can always see every application.
            </p>
            <SimplePagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              label="the access matrix"
            />
          </div>
        </>
      </SurfaceState>
    </div>
  );
}
