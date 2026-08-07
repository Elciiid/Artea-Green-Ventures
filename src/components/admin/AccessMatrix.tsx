"use client";

// Application access — a real table (member rows × application columns),
// matching the reference's Access tab exactly (docs/superpowers/plans/
// 2026-08-07-artea-green-glow-reskin.md), replacing the previous
// expandable-row pattern. That pattern existed specifically to avoid one
// table column per application at scale (see git history) — a real
// concern this table doesn't remove, just accepts: horizontal scroll
// (overflow-x-auto, same escape hatch ApplicationRegister.tsx already
// uses) keeps it usable past a handful of applications, but it will read
// worse than the expandable version once there are many. Flagged here as
// a deliberate trade for matching the reference, not an oversight.
//
// One thing this table does NOT copy from the reference: admin rows. The
// reference's mockup shows every role including admin with checkboxes
// (all checked, decorative — its Person.access is fake local state with no
// real access-control distinction behind it). This app's real data model
// already excludes admin from fetchGrantableProfiles() entirely, because
// admin access is unconditional, not grant-based — "Administrators can
// always see every application" (kept below) is the accurate statement;
// giving admin fake checkboxes here would misrepresent how access
// actually works.

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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 10;

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
  const [toggledGrants, setToggledGrants] = useState<LiveGrant[] | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

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
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="shrink-0">
        <PeopleSectionHeading
          label="Application access"
          description="Tick the applications each member can open. Admins always see everything."
        />
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading access…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load access"
        errorHeadingLevel="h3"
        empty={false}
        emptyContent={null}
        className="glass mt-9 rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        <>
          <div className="mt-5">
            <Input
              type="search"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter by name or role…"
              aria-label="Filter people by name or role"
              className="max-w-sm border-ash/25 bg-void/40 text-bone"
            />
          </div>

          <div className="mt-4 rounded-sm border border-ash/20 bg-pine p-6 shadow-panel">
            <SurfaceState
              loading={false}
              loadingLabel=""
              error={null}
              empty={pagedProfiles.length === 0}
              emptyContent={
                allProfiles.length === 0 ? (
                  <>No one to grant access to yet.</>
                ) : (
                  <>No one matches &quot;{filter}&quot;.</>
                )
              }
              className="py-8 text-center text-sm text-ash"
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[640px] border-collapse text-left">
                  <TableCaption className="sr-only">Application access</TableCaption>
                  <TableHeader>
                    <TableRow className="border-ash/30 hover:bg-transparent">
                      <TableHead scope="col" className="h-auto px-0 py-3 text-label font-semibold uppercase tracking-[0.12em] text-ash">
                        Member
                      </TableHead>
                      {applications.map((app) => (
                        <TableHead
                          key={app.id}
                          scope="col"
                          className="h-auto px-4 py-3 align-bottom"
                        >
                          <span className="block font-mono text-[11px] tracking-[0.08em] text-ash">
                            {app.reference}
                          </span>
                          <span className="mt-0.5 block max-w-[160px] truncate text-xs font-normal text-bone">
                            {app.title}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead scope="col" className="h-auto px-4 py-3 text-right text-label font-semibold uppercase tracking-[0.12em] text-ash">
                        Granted
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedProfiles.map((profile) => {
                      const count = grants.filter((g) => g.profile_id === profile.id).length;
                      return (
                        <TableRow key={profile.id} className="border-ash/15 last:border-b-0">
                          <TableCell className="p-0 py-4 align-top">
                            <span className="block text-sm font-medium text-bone">{profile.name}</span>
                            <span className="block text-[11px] uppercase tracking-[0.1em] text-ash">
                              {profile.role}
                            </span>
                          </TableCell>
                          {applications.map((app) => {
                            const key = grantKey(app.id, profile.id);
                            const checked = grants.some(
                              (g) => g.application_id === app.id && g.profile_id === profile.id
                            );
                            const busy = pending.has(key);
                            return (
                              <TableCell key={app.id} className="p-0 px-4 py-4 align-top">
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
                              </TableCell>
                            );
                          })}
                          <TableCell className="p-0 px-4 py-4 text-right align-top text-sm font-light text-ash">
                            {count} of {applications.length}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </SurfaceState>
          </div>

          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ash">Administrators can always see every application.</p>
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
