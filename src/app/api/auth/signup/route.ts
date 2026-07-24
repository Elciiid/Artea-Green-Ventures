// The real signup boundary. The browser never calls supabase.auth.signUp()
// directly for this flow — it POSTs here, so the domain check can't be
// skipped by calling a client-side function straight from devtools. New
// accounts still default to role "staff", unchanged from before.
//
// The whole handler runs inside one try/catch: any unexpected failure
// (a Supabase network hiccup, anything) must still come back as a clean
// JSON error, never Next's default HTML error page — the client always
// calls res.json() on the response and would otherwise throw on that too.

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = "arteagreenventures.com";

export async function POST(request: Request) {
  try {
    let body: { name?: string; email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        { error: "Fill in your name, email, and a password of at least 8 characters." },
        { status: 400 }
      );
    }

    const parts = email.toLowerCase().split("@");
    if (parts.length !== 2 || parts[1] !== ALLOWED_DOMAIN) {
      return NextResponse.json(
        { error: `Sign-up is limited to @${ALLOWED_DOMAIN} email addresses.` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: "staff" } },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.session) {
      return NextResponse.json({
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      });
    }
    return NextResponse.json({ pendingConfirmation: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
