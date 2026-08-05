// Service-role-backed admin route: assign a profile's company and/or toggle
// its manager status. Same shape as src/app/api/admin/set-role/route.ts and
// for the identical reason — agv_profiles has no RLS "admin write" policy
// for other people's rows, only "own profile — update" (10a,
// auth.uid() = id) and "profiles — admin read" (10b-1, SELECT only). So even
// a signed-in admin's own anon-bound client can't touch someone else's
// company_id/is_company_manager via RLS, trigger aside. This route verifies
// the caller is admin itself (reading their OWN row, which the existing
// own-row-read policy already allows), then writes via the service-role
// client — which agv_prevent_self_role_escalation already lets through,
// since a service-role connection has no JWT subject (auth.uid() is null).
//
// Unlike set-role, there is no "can't change your own profileId" guard here:
// that restriction exists on set-role specifically to prevent a sole admin
// from demoting themselves and locking the org out of /admin. Company
// assignment and manager status carry no equivalent lockout risk — an admin
// remains a full admin (agv_is_admin() is checked independently of company
// fields everywhere) regardless of what this route sets on their own row.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

// Canonical 8-4-4-4-12 hyphenated hex only — see set-role/route.ts for why
// this pins the input to one rendering before it reaches Postgres's
// case/format-tolerant uuid comparison.
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type RequestBody = {
  profileId?: string;
  companyId?: string | null;
  isCompanyManager?: boolean;
};

export async function POST(request: Request) {
  try {
    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    const { profileId, companyId, isCompanyManager } = body;

    if (typeof profileId !== "string" || !profileId || !UUID_RE.test(profileId)) {
      return NextResponse.json({ error: "Invalid profileId." }, { status: 400 });
    }
    if (companyId !== undefined && companyId !== null && !UUID_RE.test(companyId)) {
      return NextResponse.json({ error: "Invalid companyId." }, { status: 400 });
    }
    if (isCompanyManager !== undefined && typeof isCompanyManager !== "boolean") {
      return NextResponse.json({ error: "Invalid isCompanyManager." }, { status: 400 });
    }
    if (companyId === undefined && isCompanyManager === undefined) {
      return NextResponse.json(
        { error: "Provide companyId and/or isCompanyManager." },
        { status: 400 }
      );
    }

    // Cookie-bound anon client, purely to find out who's calling — see
    // set-role/route.ts for why setAll is a deliberate no-op here.
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

    const update: { company_id?: string | null; is_company_manager?: boolean } = {};
    if (companyId !== undefined) update.company_id = companyId;
    if (isCompanyManager !== undefined) update.is_company_manager = isCompanyManager;

    const admin = getSupabaseServiceClient();
    const { error: updateError, data: updated } = await admin
      .from("agv_profiles")
      .update(update)
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
