"use client";

// Directory tab (formerly "Roles") — every person in the system (admin,
// staff, AND client — the old Roles tab already fetched everyone via
// fetchAllProfiles; this just displays them as grouped cards instead of a
// Select-driven picker), grouped into "Admin & staff" and "Clients". Click a
// card to open RoleChangeDialog.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@/lib/session";
import {
  fetchAllProfiles,
  setProfileRole,
  type ProfileForRoleAssignment,
} from "@/lib/supabase/roles";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import RoleChangeDialog from "@/components/admin/RoleChangeDialog";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profiles: ProfileForRoleAssignment[] };

const ROLE_BADGE_STYLE: Record<Role, string> = {
  admin: "border-signal/40 text-signal",
  staff: "border-ash/40 text-ash",
  client: "border-ash/40 text-ash",
};

export default function PersonDirectory() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [editing, setEditing] = useState<ProfileForRoleAssignment | null>(null);

  async function load() {
    setState({ status: "loading" });
    try {
      const profiles = await fetchAllProfiles();
      setState({ status: "ready", profiles });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Couldn't load the directory.",
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(role: Role) {
    if (!editing) return;
    try {
      await setProfileRole(editing.id, role);
      toast.success(`${editing.name} is now ${role}.`);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change role.");
    }
  }

  const profiles = state.status === "ready" ? state.profiles : [];
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

      {state.status === "loading" ? (
        <p role="status" className="mt-5 text-sm text-ash">
          Loading…
        </p>
      ) : state.status === "error" ? (
        <p className="mt-5 text-sm text-amber">{state.message}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-8">
          <PersonGroup title="Admin & staff" people={staffAndAdmin} onSelect={setEditing} />
          <PersonGroup title="Clients" people={clients} onSelect={setEditing} />
        </div>
      )}

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
}: {
  title: string;
  people: ProfileForRoleAssignment[];
  onSelect: (person: ProfileForRoleAssignment) => void;
}) {
  return (
    <section>
      <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
        {title}
      </h2>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-ash">No one here yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => (
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
          ))}
        </ul>
      )}
    </section>
  );
}
