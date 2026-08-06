// Session — real Supabase Auth (Phase 10a), replacing the hardcoded
// "any password works" demo check.
//
// switchAccount() and the one-click login rows were removed for production
// readiness — both re-authenticated via signInWithPassword() with zero human
// interaction, which doesn't reflect how a real user signs in. Real sign-in
// now always goes through the manual form.

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
  /** Company this account belongs to. Meaningful only for role === "client"
   * profiles by construction — staff/admin never have company_id set under
   * normal operation (see the Companies branch's own defense-in-depth role
   * filters). Carried through as-is, no special-casing needed here. */
  companyId: string | null;
  /** Whether this account manages its company's roster/application access.
   * Same "client"-only-by-construction caveat as companyId above. */
  isCompanyManager: boolean;
};

/**
 * Post-login landing. Phase 18 sent admin/staff to the new Home hub while
 * client stayed on /portal ("client gets no Home hub at all"). That decision
 * is reversed here, deliberately, as this task's own explicit requirement:
 * every role now lands on /home. `role` is kept as a parameter (unused) so
 * every existing call site — `roleHome(account.role)` throughout the app —
 * keeps working unchanged; only this function's body needed to change.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- see comment above
export function roleHome(role: Role): string {
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

/**
 * True when a Supabase Auth error genuinely means "wrong email or password" —
 * as opposed to a config, network, or server-side failure that would
 * otherwise look identical to a caller that only checks `if (error)`.
 * `invalid_credentials` is GoTrue's own error code for this case, present
 * on any AuthApiError the server itself returned (as opposed to one
 * constructed client-side, e.g. from a thrown config error).
 */
export function isInvalidCredentialsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "invalid_credentials"
  );
}

/**
 * True when a Supabase Auth MFA error genuinely means "the code you entered
 * doesn't match" — as opposed to an expired/already-used challenge, an IP
 * mismatch, rate limiting, or a config/network failure that would otherwise
 * look identical to a caller that only checks `if (error)`.
 */
export function isMfaVerificationFailedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "mfa_verification_failed"
  );
}

type ProfileRow = {
  id: string;
  name: string;
  role: Role;
  organization_id: string;
  company_id: string | null;
  is_company_manager: boolean;
};

async function loadAccount(): Promise<Account | null> {
  let supabase: ReturnType<typeof getSupabaseClient>;
  try {
    supabase = getSupabaseClient();
  } catch {
    // env not configured yet — behave as signed-out so the login screen renders
    return null;
  }
  // Everything past this point used to run unguarded — if getUser() or the
  // profile query ever threw (a transient error, a cookie not fully synced
  // yet right after a redirect-based flow like OAuth), the promise driving
  // `hydrated` rejected silently and nothing ever set it, stranding the app
  // on AppShell's loading screen forever. Found chasing a white-screen
  // report right after the first real OAuth round-trip — that flow is the
  // first thing in this app to depend on the browser picking up a session
  // from cookies set by a server redirect, rather than supabase-js writing
  // its own session directly (what signInWithPassword does), so it's the
  // first path likely to hit a timing issue like this.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("agv_profiles")
      .select("id, name, role, organization_id, company_id, is_company_manager")
      .eq("id", user.id)
      .single();
    const profile = (data as ProfileRow | null) ?? null;

    // Fall back to auth metadata only for display niceties (name) if the
    // profile row isn't readable yet. role is deliberately NOT read from
    // metadata here — raw_user_meta_data is client-suppliable via the
    // public anon key (see 20260805190000_fix_signup_role_injection) and was
    // never a trustworthy source for it, even client-side. RLS is what
    // actually gates access server-side regardless of what this renders, so
    // this fallback was only ever cosmetic — but rendering it from
    // attacker-controlled data was still the wrong default to reach for.
    // While the profile row is momentarily unreadable, default to 'client',
    // this app's least-privileged role, matching the trigger's own default.
    const meta = user.user_metadata ?? {};
    return {
      id: user.id,
      email: user.email ?? "",
      name: profile?.name ?? (meta.name as string) ?? user.email ?? "",
      role: profile?.role ?? "client",
      organizationId: profile?.organization_id ?? "",
      companyId: profile?.company_id ?? null,
      isCompanyManager: profile?.is_company_manager ?? false,
    };
  } catch {
    return null;
  }
}

export type OAuthProvider = "azure";

type SessionState = {
  account: Account | null;
  /** true once the initial auth state has resolved */
  hydrated: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; kind?: "invalid_credentials" | "unexpected" }>;
  /** Redirects the browser to the provider's login — resolves only on failure. */
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>;
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

  signIn: async (email, password) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!error) return { error: null }; // onAuthStateChange will populate `account`.
      if (isInvalidCredentialsError(error)) {
        return { error: error.message, kind: "invalid_credentials" };
      }
      // Anything else (missing config, network failure, rate limiting, a
      // GoTrue outage...) is not a wrong password — the caller should tell
      // the user something distinct from that. The real cause still goes to
      // the console since callers don't get to see it.
      console.error("Sign-in failed:", error);
      return { error: error.message, kind: "unexpected" };
    } catch (e) {
      console.error("Sign-in failed:", e);
      return {
        error: e instanceof Error ? e.message : "Auth is not configured.",
        kind: "unexpected",
      };
    }
  },

  signInWithOAuth: async (provider) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // On success the browser is already navigating to the provider — there's
      // no session to populate yet. onAuthStateChange picks it up after
      // /auth/callback exchanges the code and redirects back.
      if (error) return { error: error.message };
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
