// Reactive application data — same Zustand + localStorage pattern as the
// session store. Seeded from the static mock data on first load; admin
// edits (status changes, notes) update here and propagate to every view
// that renders an application. "Reset demo data" restores the seed.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  APPLICATIONS,
  PIPELINE,
  type Application,
  type Stage,
} from "./mock-data";

function seed(): Application[] {
  return structuredClone(APPLICATIONS);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type ApplicationsState = {
  applications: Application[];
  /** true once persisted edits have been restored on the client */
  hydrated: boolean;
  setStage: (id: string, stage: Stage, actor: string) => void;
  addNote: (id: string, text: string, actor: string) => void;
  resetDemo: () => void;
  _setHydrated: (v: boolean) => void;
};

export const useApplications = create<ApplicationsState>()(
  persist(
    (set) => ({
      applications: seed(),
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
      resetDemo: () => set({ applications: seed() }),
      _setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "agv-demo-applications",
      partialize: (s) => ({ applications: s.applications }),
      onRehydrateStorage: () => (state) => state?._setHydrated(true),
    }
  )
);
