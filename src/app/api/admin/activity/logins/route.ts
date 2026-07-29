// Admin-only read of sign-in/sign-up activity.
//
// Unlike agv_audit_log (tab 2), there is no existing backend for this tab —
// auth.users isn't in a schema PostgREST/RLS exposes to anon/authenticated
// roles at all, so this can't be a client-side query no matter who's asking.
// A thin service-role read is the smallest thing that actually works: verify
// the caller is admin (same pattern as /api/admin/set-role), then use the
// Admin API's listUsers(), which already returns created_at/last_sign_in_at.
// Bare-bones on purpose — first page only, no search/filter/pagination UI.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
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

    const admin = getSupabaseServiceClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 100 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        provider: u.app_metadata?.provider ?? "email",
      }))
      .sort((a, b) => {
        const at = a.last_sign_in_at ?? a.created_at;
        const bt = b.last_sign_in_at ?? b.created_at;
        return new Date(bt).getTime() - new Date(at).getTime();
      });

    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
