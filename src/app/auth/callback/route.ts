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
    const role = domain === ALLOWED_STAFF_DOMAIN ? "staff" : "client";
    const admin = getSupabaseServiceClient();
    await admin.from("agv_profiles").update({ role }).eq("id", user.id);
  }

  return response;
}
