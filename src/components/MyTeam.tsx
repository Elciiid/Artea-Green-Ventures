"use client";

// My Team — the client-manager's own grant/revoke page, scoped entirely to
// their own company_id. Same expandable-row pattern as AccessMatrix.tsx
// (src/components/admin/AccessMatrix.tsx), narrowed twice: the roster is
// only fellow same-company clients (not every grantable profile in the
// system), and the checklist is only applications within the company's own
// live scope (not every application). grantAccess/revokeAccess below are the
// exact same access.ts calls AccessMatrix uses, completely unchanged — the
// RLS that lets a manager use them for a same-company teammate within scope
// was already shipped and adversarially tested in the Companies work; this
// page only adds the READ side (src/lib/supabase/team.ts +
// supabase/migrations/20260806100000_my_team_manager_read.sql).

import { useState } from "react";
import { toast } from "sonner";
import { fetchLiveGrants, grantAccess, revokeAccess, type LiveGrant } from "@/lib/supabase/access";
import { loadTeamData } from "@/lib/supabase/team";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { useSession } from "@/lib/session";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 5;

function grantKey(applicationId: string, profileId: string): string {
  return `${applicationId}:${profileId}`;
}

export default function MyTeam() {
  // AppShell (requireCompanyManager) has already redirected away anyone
  // without a company by the time this mounts, so companyId is only ever
  // null for the brief instant before hydration — the loader below handles
  // that the same way UserPortalView handles a not-yet-known accountId.
  const companyId = useSession((s) => s.account?.companyId ?? null);
  const selfId = useSession((s) => s.account?.id ?? null);

  const { state } = useAsyncResource(
    () =>
      companyId && selfId
        ? loadTeamData(companyId, selfId)
        : Promise.resolve({ roster: [], applications: [], grants: [] }),
    [companyId, selfId],
    "Something went wrong loading your team."
  );

  // Toggling a checkbox re-reads only the live grants — same narrower-than-
  // a-full-reload pattern as AccessMatrix, so a click doesn't flash the
  // spinner over the whole page.
  const [toggledGrants, setToggledGrants] = useState<LiveGrant[] | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const applications = state.status === "ready" ? state.data.applications : [];
  const roster = state.status === "ready" ? state.data.roster : [];
  const grants = toggledGrants ?? (state.status === "ready" ? state.data.grants : []);

  async function handleToggle(appId: string, profileId: string) {
    if (state.status !== "ready") return;
    const key = grantKey(appId, profileId);
    if (pending.has(key)) return;

    const existing = grants.find((g) => g.application_id === appId && g.profile_id === profileId);

    setPending((p) => new Set(p).add(key));
    try {
      if (existing) {
        await revokeAccess(existing.id);
      } else {
        await grantAccess(appId, profileId);
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

  const filteredRoster = roster.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredRoster.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRoster = filteredRoster.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function onFilterChange(value: string) {
    setFilter(value);
    setPage(1);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
          Company account
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">My Team</h1>
        <div className="mt-5">
          <PeopleSectionHeading
            label="Access"
            description="Choose which of your company's applications each teammate can see. Click a name to expand their applications, then check a box to grant or revoke access."
          />
        </div>
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading your team…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load your team"
        errorHeadingLevel="h3"
        empty={false}
        emptyContent={null}
        className="glass mt-9 rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        <>
          <div className="mt-6 shrink-0">
            <Input
              type="search"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter by name…"
              aria-label="Filter teammates by name"
              className="max-w-sm border-ash/25 bg-void/40 text-bone"
            />
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <SurfaceState
              loading={false}
              loadingLabel=""
              error={null}
              empty={pagedRoster.length === 0}
              emptyContent={
                roster.length === 0 ? (
                  <>No teammates on your company&apos;s roster yet.</>
                ) : (
                  <>No one matches &quot;{filter}&quot;.</>
                )
              }
              className="glass rounded-2xl py-8 text-center text-sm text-ash backdrop-blur-xl"
            >
              <ul className="flex flex-col gap-2">
                {pagedRoster.map((profile) => {
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
                            aria-label={`${profile.name}, ${count} of ${applications.length} applications`}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal/15 text-sm font-bold text-signal">
                                {profile.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0 truncate font-display text-sm font-bold text-bone">
                                {profile.name}
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
                            {applications.length === 0 ? (
                              <li className="py-1.5 text-sm text-ash">
                                No applications are in your company&apos;s scope yet.
                              </li>
                            ) : (
                              applications.map((app) => {
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
                                      onClick={() => handleToggle(app.id, profile.id)}
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
                              })
                            )}
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
              You can only grant or revoke access within your company&apos;s assigned applications.
            </p>
            <SimplePagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              label="your team"
            />
          </div>
        </>
      </SurfaceState>
    </div>
  );
}
