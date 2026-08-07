"use client";

// Directory tab — every person in the system (admin, staff, client), one
// flat list (no Admin&Staff/Clients grouping — matches the reference
// Directory tab exactly, see docs/superpowers/plans/2026-08-07-artea-
// green-glow-reskin.md), each row showing an inline role pill-group.
//
// One deliberate deviation from the reference: its pill group applies a
// role change instantly on click (its own local useState, no confirmation
// — reasonable for a mockup with fake data, not for a real admin console).
// Clicking a *different* role here still opens RoleChangeDialog exactly as
// before — same pre-select, same admin-promotion warning, same self-
// demotion guard. The pill group is a visual preview of the current role
// and an entry point into that real flow, not a literal instant-apply
// control. Flagged here rather than silently keeping the old click-card
// pattern or silently adopting the reference's unsafe instant-apply one.
//
// Company name isn't shown for the same reason email isn't: this app has
// no per-profile email exposed to an RLS-scoped client query (the
// reference's mockup has fake Person.email baked into portal-data.ts —
// this app's only real email source is fetchLoginActivity(), a system-wide
// admin-API list keyed by auth user, not convenient to join here). Company
// name for clients IS real and cheap (company_id already selected by
// fetchAllProfiles), so that's shown; email is a genuine, flagged gap.

import { useState } from "react";
import { toast } from "sonner";
import { useSession, type Role } from "@/lib/session";
import {
  fetchAllProfiles,
  setProfileRole,
  type ProfileForRoleAssignment,
} from "@/lib/supabase/roles";
import { fetchCompanies, type Company } from "@/lib/supabase/companies";
import { useAsyncResource } from "@/lib/useAsyncResource";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import RoleChangeDialog from "@/components/admin/RoleChangeDialog";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 10;
const ROLE_OPTIONS: Role[] = ["admin", "staff", "client"];

type DirectoryData = { profiles: ProfileForRoleAssignment[]; companies: Company[] };

function loadDirectory(): Promise<DirectoryData> {
  return Promise.all([fetchAllProfiles(), fetchCompanies()]).then(([profiles, companies]) => ({
    profiles,
    companies,
  }));
}

export default function PersonDirectory() {
  const { state, refetch } = useAsyncResource(loadDirectory, [], "Couldn't load the directory.");
  const [editing, setEditing] = useState<ProfileForRoleAssignment | null>(null);
  const [page, setPage] = useState(1);
  // An admin can't change their own role — the API route rejects a
  // self-targeted write with a 403 regardless of what the UI does. This just
  // makes that visible up front (own row's pills are inert, badged "you")
  // instead of letting someone pick a role and only then get an error back.
  // Client-side polish only; the route is the actual enforcement.
  const selfId = useSession((s) => s.account)?.id ?? null;

  async function handleRoleChange(role: Role) {
    if (!editing) return;
    try {
      await setProfileRole(editing.id, role);
      toast.success(`${editing.name} is now ${role}.`);
      setEditing(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change role.");
    }
  }

  const profiles = state.status === "ready" ? state.data.profiles : [];
  const companies = state.status === "ready" ? state.data.companies : [];
  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "Unassigned") : "Unassigned";

  const totalPages = Math.max(1, Math.ceil(profiles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = profiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="shrink-0">
        <PeopleSectionHeading
          label="Directory"
          description="Change a member's role to grant or revoke portal privileges."
        />
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading…"
        error={state.status === "error" ? state.message : null}
        // Unreachable in practice: this tab requires a signed-in admin, who
        // is themselves a row in the fetched profile list.
        empty={false}
        emptyContent={null}
        className="mt-5"
      >
        <ul className="mt-5 divide-y divide-ash/15">
          {paged.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal/15 text-sm font-semibold text-signal"
                >
                  {person.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-bone">
                    {person.name}
                    {person.id === selfId && (
                      <span className="ml-2 rounded-full border border-ash/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ash">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-light text-ash">
                    {person.role === "client" ? companyName(person.company_id) : "Artea Green Ventures"}
                  </p>
                </div>
              </div>

              <div
                role="group"
                aria-label={`Role for ${person.name}, currently ${person.role}`}
                className="flex items-center gap-1 rounded-full border border-ash/20 bg-void/50 p-1"
              >
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={person.id === selfId}
                    onClick={() => setEditing(person)}
                    aria-label={
                      role === person.role
                        ? `${person.name}'s current role: ${role}`
                        : `Change ${person.name}'s role to ${role}`
                    }
                    className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition disabled:cursor-default disabled:opacity-60 ${
                      person.role === role
                        ? "bg-signal text-void"
                        : "text-ash hover:text-bone disabled:hover:text-ash"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        {profiles.length > PAGE_SIZE && (
          <div className="mt-3">
            <SimplePagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              label="directory"
            />
          </div>
        )}
      </SurfaceState>

      <RoleChangeDialog
        person={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onConfirm={handleRoleChange}
      />
    </div>
  );
}
