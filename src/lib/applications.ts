// Reactive application data — same Zustand + localStorage pattern as the
// session store. Seeded from the static mock data on first load; admin
// edits (status changes, notes, visibility) update here and propagate to
// every view. "Reset demo data" restores the seed.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "./session";
import {
  APPLICATIONS,
  PIPELINE,
  type Application,
  type Stage,
} from "./mock-data";

// A portal user and which applications they're allowed to see. Admins see
// everything regardless, so their visibleApplicationIds is unused.
export type PortalUser = {
  id: string; // email — matches the session account
  name: string;
  role: Role;
  visibleApplicationIds: string[];
};

function seedApplications(): Application[] {
  return structuredClone(APPLICATIONS);
}

function seedUsers(): PortalUser[] {
  return [
    { id: "admin@agv-demo.com", name: "A. Mercer", role: "admin", visibleApplicationIds: [] },
    {
      id: "user1@agv-demo.com",
      name: "S. Whitfield",
      role: "user",
      visibleApplicationIds: ["AGV-2026-0142", "AGV-2026-0118"],
    },
    {
      id: "user2@agv-demo.com",
      name: "R. Santiago",
      role: "user",
      visibleApplicationIds: ["AGV-2026-0155"],
    },
  ];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Applications a given account may see — admins see all; users see their list. */
export function visibleApplicationsFor(
  account: { email: string; role: Role },
  applications: Application[],
  users: PortalUser[]
): Application[] {
  if (account.role === "admin") return applications;
  const user = users.find((u) => u.id === account.email);
  const ids = new Set(user?.visibleApplicationIds ?? []);
  return applications.filter((a) => ids.has(a.id));
}

export function isApplicationVisible(
  account: { email: string; role: Role },
  appId: string,
  users: PortalUser[]
): boolean {
  if (account.role === "admin") return true;
  const user = users.find((u) => u.id === account.email);
  return !!user?.visibleApplicationIds.includes(appId);
}

type ApplicationsState = {
  applications: Application[];
  users: PortalUser[];
  /** true once persisted edits have been restored in the browser */
  hydrated: boolean;
  setStage: (id: string, stage: Stage, actor: string) => void;
  addNote: (id: string, text: string, actor: string) => void;
  toggleVisibility: (userId: string, appId: string) => void;
  resetDemo: () => void;
  _setHydrated: (v: boolean) => void;
};

export const useApplications = create<ApplicationsState>()(
  persist(
    (set) => ({
      applications: seedApplications(),
      users: seedUsers(),
      hydrated: false,
      setStage: (id, stage, actor) =>
        set((s) => ({
          applications: s.applications.map((a) => {
            if (a.id !== id || a.stage === stage) return a;
            const label = PIPELINE.find((p) => p.id === stage)?.label ?? stage;
            return {
              ...a,
              stage,
              // the note ("Pending documents", "Approved") described the
              // previous state — drop it rather than let it go stale
              statusNote: undefined,
              timeline: [
                ...a.timeline,
                {
                  at: today(),
                  actor,
                  kind: "status" as const,
                  text: `Status moved to ${label}.`,
                },
              ],
            };
          }),
        })),
      addNote: (id, text, actor) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id
              ? {
                  ...a,
                  timeline: [
                    ...a.timeline,
                    { at: today(), actor, kind: "comment" as const, text },
                  ],
                }
              : a
          ),
        })),
      toggleVisibility: (userId, appId) =>
        set((s) => ({
          users: s.users.map((u) => {
            if (u.id !== userId) return u;
            const has = u.visibleApplicationIds.includes(appId);
            return {
              ...u,
              visibleApplicationIds: has
                ? u.visibleApplicationIds.filter((x) => x !== appId)
                : [...u.visibleApplicationIds, appId],
            };
          }),
        })),
      resetDemo: () => set({ applications: seedApplications(), users: seedUsers() }),
      _setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "agv-demo-applications",
      partialize: (s) => ({ applications: s.applications, users: s.users }),
      onRehydrateStorage: () => (state) => state?._setHydrated(true),
    }
  )
);
