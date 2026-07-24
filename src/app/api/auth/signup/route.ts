// The real signup boundary, serving both audiences from one endpoint:
//
//   - @arteagreenventures.com emails become staff, exactly as before — a
//     normal signUp() call, which respects this Supabase project's own
//     "Confirm email" setting and sends a real verification link. Domain
//     alone is the trust basis for staff access, so proving mailbox
//     ownership matters here.
//   - Any other email becomes a client, with NO email sent at all. Clients
//     start with zero application access regardless (an admin still has to
//     grant it via /admin/access), so the checkpoint that matters for them
//     is that manual grant, not an email round-trip. Using
//     auth.admin.createUser({ email_confirm: true }) creates the account
//     already-verified — Supabase never attempts a delivery, so this path
//     can never bounce, unlike a real signUp() call to an address nobody
//     owns.
//
// The whole handler runs inside one try/catch: any unexpected failure must
// still come back as a clean JSON error, never Next's default HTML error
// page — the client always calls res.json() on the response.
//
// Rate limit: the client-signup branch creates accounts with the
// service_role key, bypassing Supabase's own signup throttling entirely —
// without a limit here, this endpoint would let anyone script mass account
// creation with zero friction. This is a simple in-memory per-IP limiter,
// not a distributed one — it resets on redeploy/restart and isn't shared
// across multiple server instances, so treat it as raising the bar against
// casual scripted abuse, not a hard guarantee at real production scale.
//
// CAPTCHA: this app never holds the Turnstile secret key (Supabase-dashboard
// only, same boundary as every other credential here), so verification has
// to happen through a real Supabase Auth call, which checks the token
// server-side using the secret Supabase already has. That's a clean fit for
// the staff branch (captchaToken passed straight into signUp()) but
// admin.createUser() — the client branch — is an Admin API call and
// structurally doesn't support CAPTCHA at all. So for clients: create the
// account first (unavoidable), then immediately require the SAME captcha
// token to succeed on a real signInWithPassword() call; if that fails for
// any reason, delete the account that was just created. No persistent
// account survives a missing/invalid token, and no email is ever sent
// either way — the account just never outlives the one request.

import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

const ALLOWED_STAFF_DOMAIN = "arteagreenventures.com";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const attemptsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = (attemptsByIp.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  attempts.push(now);
  attemptsByIp.set(ip, attempts);
  return attempts.length > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429 }
      );
    }

    let body: { name?: string; email?: string; password?: string; turnstileToken?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    const turnstileToken = body.turnstileToken ?? "";

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        { error: "Fill in your name, email, and a password of at least 8 characters." },
        { status: 400 }
      );
    }
    if (!EMAIL_SHAPE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!turnstileToken) {
      return NextResponse.json({ error: "Complete the verification challenge." }, { status: 400 });
    }

    const domain = email.toLowerCase().split("@")[1];
    const isStaff = domain === ALLOWED_STAFF_DOMAIN;

    if (isStaff) {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role: "staff" }, captchaToken: turnstileToken },
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (data.session) {
        return NextResponse.json({
          role: "staff",
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
        });
      }
      return NextResponse.json({ pendingConfirmation: true });
    }

    // Client path — created pre-verified via the Admin API so Supabase never
    // sends (and can never bounce) a confirmation email for an address we
    // haven't proven ownership of. Not CAPTCHA-gated at creation (Admin API
    // calls don't support it) — verified immediately after via the
    // signInWithPassword call below instead; see the file header comment.
    const adminClient = getSupabaseServiceClient();
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "client" },
    });
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }
    const createdId = created.user?.id;

    // createUser() doesn't return a session — sign in immediately so the
    // browser can hydrate its own session, same contract as the staff path.
    // This call is also where the CAPTCHA token actually gets checked for
    // this branch (see file header) — on any failure here, roll back the
    // account we just created rather than leave an unverified one behind.
    const anonClient = getSupabaseServerClient();
    const { data: signedIn, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: turnstileToken },
    });
    if (signInError || !signedIn.session) {
      if (createdId) {
        await adminClient.auth.admin.deleteUser(createdId);
      }
      const message =
        signInError?.message.toLowerCase().includes("captcha")
          ? "Complete the verification challenge."
          : "Something went wrong creating your account. Try again.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({
      role: "client",
      session: {
        access_token: signedIn.session.access_token,
        refresh_token: signedIn.session.refresh_token,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
