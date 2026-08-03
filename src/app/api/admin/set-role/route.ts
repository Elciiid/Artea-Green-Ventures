// Service-role-backed admin route: change another profile's role.
//
// agv_profiles has no RLS "admin write" policy for other people's rows — only
// "own profile — update" (10a, auth.uid() = id) and "profiles — admin read"
// (10b-1, admin may SELECT every row, not UPDATE it). So even a signed-in
// admin's own anon-bound client can't touch someone else's role via RLS,
// trigger aside. Rather than add a third column-scoped write policy to a
// table that's already had two column-restriction gaps found on it (see
// 20260725100000 and 20260728120000), this route verifies the caller is
// admin itself (reading their OWN row, which the existing own-row-read policy
// already allows), then writes via the service-role client — which the
// existing agv_prevent_self_role_escalation trigger already lets through,
// since a service-role connection has no JWT subject (auth.uid() is null).

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const VALID_ROLES = ["admin", "staff", "client"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

// Canonical 8-4-4-4-12 hyphenated hex only. Postgres's uuid type accepts far
// more than this on the `.eq("id", profileId)` below — it normalises case and
// tolerates omitted hyphens and surrounding braces — so "{3F8A1C2D...}" and
// "3f8a1c2d..." (no hyphens) both resolve to the SAME row as the canonical
// form. The self-write guard further down compares strings in JS, which sees
// those as different values. Pinning the input to one rendering here is what
// keeps the JS comparison and the SQL comparison talking about the same thing;
// case is then handled by comparing case-insensitively at the guard itself.
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidRole(value: unknown): value is ValidRole {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    let body: { profileId?: string; role?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    const profileId = body.profileId;
    const role = body.role;
    if (
      typeof profileId !== "string" ||
      !profileId ||
      !UUID_RE.test(profileId) ||
      !isValidRole(role)
    ) {
      return NextResponse.json({ error: "Invalid profileId or role." }, { status: 400 });
    }

    // Cookie-bound anon client, purely to find out who's calling. Not used
    // for the write itself — see the file header for why RLS can't do that
    // for another person's row. setAll is a no-op: this route's response is
    // a short-lived JSON reply, not a page navigation, so there's nowhere
    // meaningful to carry a refreshed session cookie back to; the rare case
    // of a token expiring mid-request just means the next normal navigation
    // refreshes it as usual.
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: callerProfile, error: callerError } = await supabase
      .from("agv_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerError || callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    // No admin may write to their OWN role through this route, whatever role
    // was requested — including a no-op write of their current role. The rule
    // is deliberately "never your own profileId" rather than "never lower your
    // own privilege": the latter is harder to reason about (and to keep
    // correct as roles change), and this route is the only path by which an
    // admin can write *another* profile's role. (It is not the app's only
    // service-role write to agv_profiles.role at all — src/app/auth/callback
    // does one too, for domain-based role assignment on brand-new OAuth
    // accounts; that one is gated on the isNewAccount window, so an
    // established admin can't reach it, but it exists.) That matters because
    // the write below bypasses RLS and the agv_prevent_self_role_escalation
    // trigger entirely (a service-role connection has no JWT subject, so
    // auth.uid() is null — see the file header), and that trigger only blocks
    // escalation anyway, never demotion. Without this check a sole admin could
    // demote themselves to staff/client and lock the org out of /admin with no
    // self-service way back in. Placed before getSupabaseServiceClient() so
    // the privileged client is never even constructed for a self-targeted
    // request. Admin-to-admin changes are unaffected.
    //
    // Compared case-insensitively because Postgres's uuid equality on the
    // `.eq("id", profileId)` write below is case-insensitive: an admin passing
    // their own id in uppercase would otherwise slip past a `===` compare and
    // still hit their own row. The other renderings uuid equality accepts
    // (hyphen-omitted, brace-wrapped) never get this far — UUID_RE rejected
    // them with a 400 back at request validation.
    if (profileId.toLowerCase() === user.id.toLowerCase()) {
      return NextResponse.json(
        { error: "You can't change your own role." },
        { status: 403 }
      );
    }

    const admin = getSupabaseServiceClient();
    const { error: updateError, data: updated } = await admin
      .from("agv_profiles")
      .update({ role })
      .eq("id", profileId)
      .select("id");
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "That profile doesn't exist." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
