// Mock session — no real auth. Role state lives in a persisted Zustand store
// so a refresh keeps you signed in during demos.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "admin" | "client";

export type DemoAccount = {
  role: Role;
  email: string;
  name: string;
  org: string;
  title: string;
};

export const DEMO_ACCOUNTS: Record<Role, DemoAccount> = {
  admin: {
    role: "admin",
    email: "admin@agv-demo.com",
    name: "A. Mercer",
    org: "Artea Green Ventures",
    title: "Operations Lead",
  },
  client: {
    role: "client",
    email: "client@agv-demo.com",
    name: "T. Alvarez",
    org: "Transport for NSW",
    title: "Project Sponsor",
  },
};

export function roleHome(role: Role): string {
  return role === "admin" ? "/admin" : "/portal";
}

type SessionState = {
  account: DemoAccount | null;
  /** true once the persisted state has been restored on the client */
  hydrated: boolean;
  signIn: (email: string) => DemoAccount | null;
  signOut: () => void;
  switchRole: () => DemoAccount | null;
  _setHydrated: (v: boolean) => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      account: null,
      hydrated: false,
      signIn: (email) => {
        const clean = email.trim().toLowerCase();
        const match =
          Object.values(DEMO_ACCOUNTS).find((a) => a.email === clean) ?? null;
        if (match) set({ account: match });
        return match;
      },
      signOut: () => set({ account: null }),
      switchRole: () => {
        const current = get().account;
        if (!current) return null;
        const next = DEMO_ACCOUNTS[current.role === "admin" ? "client" : "admin"];
        set({ account: next });
        return next;
      },
      _setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "agv-demo-session",
      partialize: (s) => ({ account: s.account }),
      onRehydrateStorage: () => (state) => state?._setHydrated(true),
    }
  )
);
