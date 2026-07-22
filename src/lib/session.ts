// Session — real Supabase Auth (Phase 10a), replacing the hardcoded
// "any password works" demo check. The store surface (account, hydrated,
// signIn, signOut, switchAccount) is unchanged so downstream components didn't
// have to change; only the internals are now real auth + the agv_profiles row.

import { create } from "zustand";
import { getSupabaseClient } from "@/lib/supabase/client";

export type Role = "admin" | "staff" | "client";

/** The two non-admin roles, which share every /portal surface. */
export const PORTAL_ROLES: Role[] = ["staff", "client"];

/** The signed-in person, assembled from the auth user + their agv_profiles row. */
export type Account = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
};

export function roleHome(role: Role): string {
  return role === "admin" ? "/admin" : "/portal";
}

/**
 * Whether to expose dev-only surfaces (the account quick-switcher, the
 * one-click demo sign-in rows, and the demo banner).
 *
 * FAIL-SAFE by design: hidden by default, shown only when we can positively
 * confirm this is not a real production environment. The quick-switcher is a
 * genuine auth bypass (shared dev seed password), so a forgotten or misspelled
 * env var must never be able to expose it.
 *
 *  - Primary signal is NODE_ENV, which Next.js sets automatically at build time
 *    (`next build` / `next start` force "production"). A real production deploy
 *    therefore hides all of this with zero configuration — nothing to remember,
 *    nothing to get wrong.
 *  - A HOSTED demo/staging build can opt back IN by explicitly setting
 *    NEXT_PUBLIC_APP_ENV="demo". Note the direction: an active, exact value is
 *    required to REVEAL the tools; the safe (hidden) state is the default and
 *    depends on no configuration at all. Any other value — unset, "development",
 *    a typo — stays hidden in a production build.
 */
export function showDevTools(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_APP_ENV === "demo";
}

// ——— dev/staging seed accounts (NOT the production user list) ———
// Used only by the dev quick-switcher and the login screen's one-click rows.
export const DEV_ACCOUNTS: { email: string; name: string; role: Role }[] = [
  { email: "admin@agv-demo.com", name: "A. Mercer", role: "admin" },
  { email: "user1@agv-demo.com", name: "S. Whitfield", role: "staff" },
  { email: "user2@agv-demo.com", name: "R. Santiago", role: "staff" },
  { email: "client1@agv-demo.com", name: "N. Reyes", role: "client" },
];

export function nextAccount(current: { email: string }): { email: string; name: string; role: Role } {
  const idx = DEV_ACCOUNTS.findIndex((a) => a.email === current.email);
  return DEV_ACCOUNTS[(idx + 1) % DEV_ACCOUNTS.length];
}

/**
 * Whether an email belongs to one of the dev/staging seed accounts.
 *
 * Used to EXCLUDE these accounts from MFA enrollment (Phase 10c). The dev
 * QuickSwitch tool re-authenticates as each seed account with the shared dev
 * seed password (`signInWithPassword`); once MFA enforcement lands (Phase
 * 12+11) an enrolled TOTP factor on a seed account would leave that switch
 * stranded at AAL1 with no way to answer the challenge. Keeping seed accounts
 * factor-free is deliberate — do NOT "fix" this by allowing enrollment on them.
 */
export function isSeedAccount(email: string): boolean {
  return DEV_ACCOUNTS.some((a) => a.email === email.toLowerCase());
}

type ProfileRow = {
  id: string;
  name: string;
  role: Role;
  organization_id: string;
};

async function loadAccount(): Promise<Account | null> {
  let supabase: ReturnType<typeof getSupabaseClient>;
  try {
    supabase = getSupabaseClient();
  } catch {
    // env not configured yet — behave as signed-out so the login screen renders
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("agv_profiles")
    .select("id, name, role, organization_id")
    .eq("id", user.id)
    .single();
  const profile = (data as ProfileRow | null) ?? null;

  // Fall back to auth metadata if the profile row isn't readable yet.
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? (meta.name as string) ?? user.email ?? "",
    role: profile?.role ?? ((meta.role as Role) ?? "staff"),
    organizationId: profile?.organization_id ?? "",
  };
}

type SessionState = {
  account: Account | null;
  /** true once the initial auth state has resolved */
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** dev-only: re-authenticate as the next seed account (cycles) */
  switchAccount: () => Promise<{ error: string | null }>;
  _init: () => void;
  _initialized: boolean;
};

export const useSession = create<SessionState>((set, get) => ({
  account: null,
  hydrated: false,
  _initialized: false,

  _init: () => {
    if (get()._initialized || typeof window === "undefined") return;
    set({ _initialized: true });

    // resolve the current session on load…
    loadAccount().then((account) => set({ account, hydrated: true }));

    // …then track every change (sign in/out, token refresh). If env isn't
    // configured yet, skip the subscription — the login screen still renders.
    try {
      getSupabaseClient().auth.onAuthStateChange(async () => {
        const account = await loadAccount();
        set({ account, hydrated: true });
      });
    } catch {
      /* not configured — loadAccount already resolved to signed-out */
    }
  },

  signIn: async (email, password) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { error: error.message };
      // onAuthStateChange will populate `account`.
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Auth is not configured." };
    }
  },

  signOut: async () => {
    try {
      await getSupabaseClient().auth.signOut();
    } catch {
      /* not configured — nothing to sign out of */
    }
  },

  switchAccount: async () => {
    if (!showDevTools()) return { error: "Account switching is disabled in production." };
    const devPassword = process.env.NEXT_PUBLIC_DEV_SEED_PASSWORD;
    if (!devPassword) {
      return { error: "NEXT_PUBLIC_DEV_SEED_PASSWORD is not set (dev only)." };
    }
    const current = get().account;
    const target = current
      ? nextAccount({ email: current.email })
      : DEV_ACCOUNTS[0];
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({
        email: target.email,
        password: devPassword,
      });
      return { error: error ? error.message : null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Auth is not configured." };
    }
  },
}));
