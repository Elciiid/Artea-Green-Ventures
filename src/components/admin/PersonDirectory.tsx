"use client";

// Directory tab (formerly "Roles") — every person in the system (admin,
// staff, AND client — the old Roles tab already fetched everyone via
// fetchAllProfiles; this just displays them as grouped cards instead of a
// Select-driven picker), grouped into "Admin & staff" and "Clients". Click a
// card to open RoleChangeDialog.

import { useState } from "react";
import { toast } from "sonner";
import { useSession, type Role } from "@/lib/session";
import {
  fetchAllProfiles,
  setProfileRole,
  type ProfileForRoleAssignment,
} from "@/lib/supabase/roles";
import { useAsyncResource } from "@/lib/useAsyncResource";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import RoleChangeDialog from "@/components/admin/RoleChangeDialog";
import SurfaceState from "@/components/SurfaceState";

const ROLE_BADGE_STYLE: Record<Role, string> = {
  admin: "border-signal/40 text-signal",
  staff: "border-ash/40 text-ash",
  client: "border-ash/40 text-ash",
};

export default function PersonDirectory() {
  const { state, refetch } = useAsyncResource(
    fetchAllProfiles,
    [],
    "Couldn't load the directory."
  );
  const [editing, setEditing] = useState<ProfileForRoleAssignment | null>(null);
  // An admin can't change their own role — the API route rejects a
  // self-targeted write with a 403 regardless of what the UI does. This just
  // makes that visible up front (own card is inert, badged "you") instead of
  // letting someone pick a role and only then get an error back. Client-side
  // polish only; the route is the actual enforcement.
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

  const profiles = state.status === "ready" ? state.data : [];
  const staffAndAdmin = profiles.filter((p) => p.role === "admin" || p.role === "staff");
  const clients = profiles.filter((p) => p.role === "client");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="shrink-0">
        <PeopleSectionHeading
          label="Directory"
          description="Everyone in the system. Click a person to change their role."
        />
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading…"
        error={state.status === "error" ? state.message : null}
        // A whole-directory empty state isn't reachable: reaching this tab at
        // all requires a signed-in admin, who is themselves a row in the
        // fetched profile list. The per-group "No one here yet." inside
        // PersonGroup covers the only empty case that can actually occur.
        empty={false}
        emptyContent={null}
        className="mt-5"
      >
        <div className="mt-5 flex flex-col gap-8">
          <PersonGroup
            title="Admin & staff"
            people={staffAndAdmin}
            onSelect={setEditing}
            selfId={selfId}
          />
          <PersonGroup title="Clients" people={clients} onSelect={setEditing} selfId={selfId} />
        </div>
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

function PersonGroup({
  title,
  people,
  onSelect,
  selfId,
}: {
  title: string;
  people: ProfileForRoleAssignment[];
  onSelect: (person: ProfileForRoleAssignment) => void;
  selfId: string | null;
}) {
  return (
    <section>
      <h3 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
        {title}
      </h3>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-ash">No one here yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) =>
            person.id === selfId ? (
              // Own card: no button semantics, no click handler, no
              // aria-label — there's no role change to offer here, so it
              // shouldn't read or behave as an actionable control. The name
              // and role stay in the accessibility tree (they're no longer
              // duplicated by an aria-label), and the "you" badge gives the
              // visible reason the card is inert.
              <li key={person.id}>
                <div className="glass flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left backdrop-blur-xl">
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal/15 text-sm font-bold text-signal">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate font-display text-sm font-bold text-bone">
                      {person.name}
                    </span>
                    <span className="shrink-0 rounded-full border border-ash/40 px-2 py-0.5 text-label uppercase tracking-[0.14em] text-ash">
                      you
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-label uppercase tracking-[0.14em] ${ROLE_BADGE_STYLE[person.role]}`}
                  >
                    {person.role}
                  </span>
                </div>
              </li>
            ) : (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onSelect(person)}
                  aria-label={`Change role for ${person.name}, currently ${person.role}`}
                  className="glass flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left backdrop-blur-xl transition hover:ring-1 hover:ring-signal/40"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal/15 text-sm font-bold text-signal">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <span aria-hidden className="truncate font-display text-sm font-bold text-bone">
                      {person.name}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-label uppercase tracking-[0.14em] ${ROLE_BADGE_STYLE[person.role]}`}
                  >
                    {person.role}
                  </span>
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
