// OAuth callback for Supabase's PKCE flow (Azure, and later Google).
// signInWithOAuth() (session.ts) sends the browser here after the provider
// redirects back with a ?code. Exchanging it here — a real top-level
// navigation with cookie access — is what lets the browser pick up a
// session automatically, unlike the password-signup route, which has no
// cookie context to write into and hands tokens back over JSON instead.
//
// Role assignment: agv_handle_new_user() (10a/10b, trigger on auth.users)
// auto-creates this account's agv_profiles row and defaults its role to
// 'staff' unless metadata says otherwise. The domain-gated signup route
// passes role explicitly, but an OAuth provider never sends one — so every
// brand-new OAuth account would land as 'staff' regardless of email domain
// unless corrected here. Only done on the account's first-ever sign-in
// (created_at ≈ last_sign_in_at, within NEW_ACCOUNT_WINDOW_MS) — never on a
// later login, so this can't silently strip an admin (or any other
// deliberately-set) role from someone who later chooses to sign in via
// Microsoft instead of a password. Uses the service-role client because the
// anon/authenticated path is now blocked from touching its own role column
// (see the 20260725100000 migration) — by design, this is the one
// legitimate server-side exception to that block.
//
// xms_edov ("Email Domain Owner Verified"): an email domain match alone is
// NOT proof of staff — this is exactly the pattern the real, named nOAuth
// vulnerability class exploits, since a Microsoft account's email address
// isn't guaranteed to come from a verified domain. xms_edov is Azure's own
// answer: an ID-token claim (added via Token configuration → optional
// claims) that says whether the tenant actually owns/verified the domain
// behind this email, not just that the string after the @ matches. Confirmed
// empirically (2026-07-27, real login) that Supabase's Azure provider copies
// it straight into user_metadata.custom_claims.xms_edov once Azure is
// configured to send it — no raw ID-token decoding needed. Absence of the
// claim is treated the same as an explicit false: fail closed, not open.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const ALLOWED_STAFF_DOMAIN = "arteagreenventures.com";
const NEW_ACCOUNT_WINDOW_MS = 30_000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    // Supabase appends error/error_code/error_description to this same
    // redirect when the provider itself (or Supabase's own token exchange)
    // rejects the attempt before ever issuing a code — the query string is
    // the only place that detail lives, and it's the one thing that told us
    // what was actually wrong across three different real failure modes
    // while first wiring Azure (bad secret, tenant mismatch, missing email
    // claim). Worth keeping for whenever the next provider hits its own
    // first-run surprise.
    console.error("[auth/callback] no code in redirect:", Object.fromEntries(searchParams));
    return NextResponse.redirect(`${origin}/?error=oauth`);
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}/`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error?.message, error?.status);
    return NextResponse.redirect(`${origin}/?error=oauth`);
  }

  const user = data.user;
  const isNewAccount =
    !!user.created_at &&
    !!user.last_sign_in_at &&
    Math.abs(
      new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime()
    ) < NEW_ACCOUNT_WINDOW_MS;

  if (isNewAccount) {
    const domain = user.email?.toLowerCase().split("@")[1] ?? "";
    const domainMatches = domain === ALLOWED_STAFF_DOMAIN;

    if (domainMatches) {
      const customClaims = user.user_metadata?.custom_claims as
        | Record<string, unknown>
        | undefined;
      const domainVerified = customClaims?.xms_edov === true;

      if (!domainVerified) {
        // Fail closed: missing/false/absent all mean "not verified" — never
        // assume absence is fine. Delete the account GoTrue just created
        // rather than leave a domain-matched-but-unverified account sitting
        // around with an ambiguous role — same "create then roll back on
        // failure" shape the client-signup route already uses elsewhere in
        // this app. Note we deliberately return a fresh redirect here
        // instead of `response`: `response` already has this session's
        // Set-Cookie headers staged on it from exchangeCodeForSession above,
        // and since the account is being deleted, that session must never
        // reach the browser at all.
        console.error(
          "[auth/callback] rejecting domain-matched OAuth signup — xms_edov not verified:",
          user.email,
          "custom_claims:",
          JSON.stringify(customClaims)
        );
        const admin = getSupabaseServiceClient();
        await admin.auth.admin.deleteUser(user.id);
        return NextResponse.redirect(`${origin}/?error=oauth_unverified_domain`);
      }
    }

    const role = domainMatches ? "staff" : "client";
    const admin = getSupabaseServiceClient();
    await admin.from("agv_profiles").update({ role }).eq("id", user.id);
  }

  return response;
}
