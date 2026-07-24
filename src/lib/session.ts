// Session — real Supabase Auth (Phase 10a), replacing the hardcoded
// "any password works" demo check.
//
// switchAccount() and the one-click login rows were removed for production
// readiness — both re-authenticated via signInWithPassword() with zero human
// interaction, which is fundamentally incompatible with Supabase's
// project-wide CAPTCHA protection (one master toggle covering every sign-in,
// no way to exempt specific callers). Real sign-in now always goes through
// the manual form, which solves a Turnstile challenge.

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

/**
 * Post-login landing. Phase 18: admin/staff default to the new Home hub;
 * client is untouched (Applications stays their home — "client gets no Home
 * hub at all" is a locked decision, not an oversight).
 */
export function roleHome(role: Role): string {
  if (role === "client") return "/portal";
  return "/home";
}

/**
 * Whether to expose dev-only surfaces (currently just the demo banner —
 * the account quick-switcher and one-click sign-in rows this used to also
 * gate were removed; see the file header comment).
 *
 * FAIL-SAFE by design: hidden by default, shown only when we can positively
 * confirm this is not a real production environment. A forgotten or
 * misspelled env var must never be able to expose a dev-only surface.
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
export const DEV_ACCOUNTS: { email: string; name: string; role: Role }[] = [
  { email: "admin@agv-demo.com", name: "A. Mercer", role: "admin" },
  { email: "user1@agv-demo.com", name: "S. Whitfield", role: "staff" },
  { email: "user2@agv-demo.com", name: "R. Santiago", role: "staff" },
  { email: "client1@agv-demo.com", name: "N. Reyes", role: "client" },
];

/**
 * Whether an email belongs to one of the dev/staging seed accounts.
 *
 * Used to EXCLUDE these accounts from MFA enrollment (Phase 10c). This was
 * originally justified by the dev quick-switcher re-authenticating as seed
 * accounts with no way to answer an MFA challenge — that tool is gone now
 * (see the file header comment), so the original justification is weaker
 * than it was. Left unchanged here since removing the exclusion wasn't asked
 * for; worth revisiting deliberately rather than as a side effect of this
 * cleanup. See isSeedAccount() call sites for where this still matters.
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
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
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

  signIn: async (email, password, captchaToken) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: captchaToken ? { captchaToken } : undefined,
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
}));
