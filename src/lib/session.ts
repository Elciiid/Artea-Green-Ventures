// Mock session — no real auth. Role state lives in a persisted Zustand store
// so a refresh keeps you signed in during demos.
//
// All demo accounts are AGV staff. "admin" manages everything; "user" is a
// staff member granted access to specific engagements (visibility lives in
// the applications store).

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "admin" | "user";

export type DemoAccount = {
  id: string; // "admin" | "user1" | "user2"
  role: Role;
  email: string;
  name: string;
  title: string; // AGV staff title
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "admin",
    role: "admin",
    email: "admin@agv-demo.com",
    name: "A. Mercer",
    title: "Operations Lead",
  },
  {
    id: "user1",
    role: "user",
    email: "user1@agv-demo.com",
    name: "S. Whitfield",
    title: "Compliance Lead",
  },
  {
    id: "user2",
    role: "user",
    email: "user2@agv-demo.com",
    name: "R. Santiago",
    title: "Regional Analyst",
  },
];

export function accountByEmail(email: string): DemoAccount | undefined {
  const clean = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === clean);
}

export function roleHome(role: Role): string {
  return role === "admin" ? "/admin" : "/portal";
}

/** The account the quick-switch would move to next (cycles in list order). */
export function nextAccount(current: DemoAccount): DemoAccount {
  const idx = DEMO_ACCOUNTS.findIndex((a) => a.email === current.email);
  return DEMO_ACCOUNTS[(idx + 1) % DEMO_ACCOUNTS.length];
}

type SessionState = {
  account: DemoAccount | null;
  /** true once the persisted state has been restored in the browser */
  hydrated: boolean;
  signIn: (email: string) => DemoAccount | null;
  signOut: () => void;
  /** cycle to the next demo account (for the header quick-switch) */
  switchAccount: () => DemoAccount | null;
  _setHydrated: (v: boolean) => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      account: null,
      hydrated: false,
      signIn: (email) => {
        const match = accountByEmail(email) ?? null;
        if (match) set({ account: match });
        return match;
      },
      signOut: () => set({ account: null }),
      switchAccount: () => {
        const current = get().account;
        if (!current) return null;
        const next = nextAccount(current);
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
