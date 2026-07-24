# Onboarding Model: Domain-Restricted Staff Signup + Invite-Only Clients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two signup paths for two trust levels — staff self-signs up at `/signup` but only with an `@arteagreenventures.com` email (enforced server-side, not just in the browser), and clients are invited by an admin from a specific application's detail page, which bundles the invite with that application's first access grant.

**Architecture:** Two new Next.js Route Handlers own every privileged operation. `/api/auth/signup` validates the email domain and performs `auth.signUp()` itself (using the anon key) so the real boundary is server code, not browser JS — the signup page then hydrates its own browser session from the tokens the route returns. `/api/admin/invite-client` independently re-verifies (via RLS, using the caller's own bearer token) that the caller is really an admin before touching the `service_role`-only Admin API (`inviteUserByEmail`), then inserts the `agv_application_access` grant row through that same caller-scoped, RLS-respecting client. A new minimal `/invite/complete` page lets a freshly-invited client set their first password, since the existing account-settings password form requires re-entering a *current* password an invited user doesn't have yet.

**Tech Stack:** Next.js 16 App Router Route Handlers, `@supabase/supabase-js` (already a direct dependency — no new packages), Supabase Auth Admin API, Postgres RLS (no schema changes needed).

## Global Constraints

- Domain allowed for self-signup: exactly `arteagreenventures.com` (case-insensitive), checked as an exact match on the part after `@` — not `endsWith`, which a crafted local-part could abuse.
- The `service_role` key lives only in `SUPABASE_SERVICE_ROLE_KEY`, a **non**-`NEXT_PUBLIC_` server env var. It is read in exactly one file (`src/lib/supabase/server.ts`) and used in exactly one route (`/api/admin/invite-client`). Never log it, never return it in a response, never import the file that reads it from any `"use client"` component.
- New accounts (both staff self-signup and client invite) keep defaulting to their existing roles (`staff`, `client`) — no role-model changes.
- No test framework exists in this repo (no jest/vitest, no test files) and this plan doesn't introduce one — every "test" step below is an empirical check against the real running dev server (`curl`/`fetch`, decoded JWTs, a real DB read), matching this project's established verification convention (see `STATUS.md` history), not an automated test suite.
- `/signup` must remain reachable regardless of `showDevTools()` — it already is (verified in Task 3's self-review step); don't add a gate.
- Nothing outside the files listed below changes.

**Researched and deliberately NOT implemented:** Supabase has no dashboard toggle for an email-domain allowlist. The closest native mechanism is a "Before User Created" Postgres Auth Hook, but (a) Supabase's own docs don't state whether it also fires for Admin-API-created users (`inviteUserByEmail`), and (b) enabling it requires a manual dashboard step only the user can perform, with no way for me to test it first. Since a wrongly-scoped hook risks silently blocking the client-invite path — a feature this plan is explicitly required to prove works — implementing it now trades a real, testable feature for an unverifiable extra layer. The Route Handler in Task 2 is the real, verified boundary. This is called out again in Known issues so it's a conscious, visible decision, not a silent gap.

---

### Task 1: Server-only Supabase clients

**Files:**
- Create: `src/lib/supabase/server.ts`

**Interfaces:**
- Produces: `getSupabaseServerClient(accessToken?: string): SupabaseClient` — anon-key client, optionally scoped to a caller via their bearer token (still fully RLS-gated, no elevated privileges).
- Produces: `getSupabaseServiceClient(): SupabaseClient` — `service_role` client, full privileges, server-only.

- [ ] **Step 1: Write the file**

```ts
// src/lib/supabase/server.ts
//
// Server-only Supabase clients for Route Handlers. Never import this file
// from a "use client" component — SUPABASE_SERVICE_ROLE_KEY has no
// NEXT_PUBLIC_ prefix, so Next.js never inlines it into a client bundle; a
// client-side import would just see `undefined` and throw immediately below.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  return url;
}

/**
 * Anon-key client for use inside a Route Handler. Pass the caller's own
 * access token (from their `Authorization: Bearer <token>` header) to have
 * Postgres RLS evaluate `auth.uid()` as that caller — this client never
 * bypasses RLS, regardless of the token passed.
 */
export function getSupabaseServerClient(accessToken?: string): SupabaseClient {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createClient(
    getUrl(),
    anonKey,
    accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : undefined
  );
}

/**
 * service_role client — bypasses RLS entirely. Only ever call this after
 * independently verifying the caller is allowed to do whatever this client
 * is about to do; RLS can't help you here.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env.local for dev and in " +
        "your host's project env vars for prod — never commit it, never put it " +
        "in a NEXT_PUBLIC_ variable."
    );
  }
  return createClient(getUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 2: Verify the file compiles and the client-side boundary holds**

Run: `cd E:\Work\Code\AVG-Portal && npx tsc --noEmit`
Expected: no new errors from this file.

Then confirm no client component imports it:
Run: `grep -rl "from \"@/lib/supabase/server\"" src --include="*.tsx" | xargs grep -l "\"use client\""`
Expected: no output (empty — nothing matches).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/server.ts
git commit -m "Add server-only Supabase clients for route handlers"
```

---

### Task 2: Domain-gated signup Route Handler

**Files:**
- Create: `src/app/api/auth/signup/route.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from Task 1.
- Produces: `POST /api/auth/signup` — body `{ name: string; email: string; password: string }` → `200 { session: { access_token: string; refresh_token: string } }` or `200 { pendingConfirmation: true }` or `400 { error: string }`. Task 3's signup page consumes this exact shape.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/auth/signup/route.ts
//
// The real signup boundary. The browser never calls supabase.auth.signUp()
// directly for this flow — it POSTs here, so the domain check can't be
// skipped by calling a client-side function straight from devtools. New
// accounts still default to role "staff", unchanged from before.

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = "arteagreenventures.com";

export async function POST(request: Request) {
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
}
```

- [ ] **Step 2: Verify the reject path with a real request — no account created**

With the dev server running (`npm run dev`), run:

```bash
curl -s -X POST http://localhost:3170/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Outsider","email":"outsider@gmail.com","password":"testpass123"}'
```

Expected: `{"error":"Sign-up is limited to @arteagreenventures.com email addresses."}` with a 400 status, and no new row in Supabase's `auth.users` for `outsider@gmail.com` (confirm via the Supabase dashboard's Auth → Users list, or ask the user to check — this is the empirical proof the spec's "when done" section asks for: rejected, not just client-side).

- [ ] **Step 3: Verify the accept path works for a real domain email**

```bash
curl -s -X POST http://localhost:3170/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Real Staffer","email":"realstaffer@arteagreenventures.com","password":"testpass123"}'
```

Expected: either `{"session":{"access_token":"...","refresh_token":"..."}}` (immediate session) or `{"pendingConfirmation":true}` (if Supabase's email-confirmation setting is on) — either way, no `error` key, and a new `auth.users` row for `realstaffer@arteagreenventures.com` with `raw_user_meta_data.role = "staff"`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/signup/route.ts
git commit -m "Add domain-gated signup route handler"
```

---

### Task 3: Wire the signup page to the new route

**Files:**
- Modify: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/signup` from Task 2.

- [ ] **Step 1: Replace the direct `signUp()` call with a fetch to the route**

In `src/app/signup/page.tsx`, replace the body of `onSubmit` (the part after the existing name/password/confirm validation, currently calling `supabase.auth.signUp(...)` directly) with:

```ts
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      if (result.session) {
        const supabase = getSupabaseClient();
        const { error: setErr } = await supabase.auth.setSession(result.session);
        if (setErr) {
          setError(setErr.message);
          setBusy(false);
          return;
        }
        router.push(roleHome("staff"));
        return;
      }
      setPendingConfirmation(true);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
```

Keep the existing client-side checks above this (name/password-length/confirm-match) exactly as they are — those stay as fast, friendly UX feedback; they're just no longer the security boundary (Task 2's route re-checks length server-side too).

- [ ] **Step 2: Update the copy for the new restriction**

Change the intro paragraph:

```tsx
<p className="mt-2 text-sm leading-relaxed text-ash">
  Register with your @arteagreenventures.com email — useful for trying
  two-step verification, which is turned off for the shared demo accounts.
</p>
```

Change the email input's placeholder from `"you@example.com"` to `"you@arteagreenventures.com"`.

Update the file's top comment to note the domain restriction is now enforced by `/api/auth/signup`, not this component.

- [ ] **Step 3: Verify `/signup` isn't gated behind `showDevTools()`**

Run: `grep -n "showDevTools" src/app/signup/page.tsx src/app/page.tsx`
Expected: no match in `signup/page.tsx` (it was never gated — the "New here? Create an account" link in `page.tsx` sits outside the `showQuickAccess` block). Confirms the hard constraint holds without needing a change.

- [ ] **Step 4: Verify in the browser**

With the dev server running, open `/signup`, submit a non-`arteagreenventures.com` email and confirm the exact error string renders inline (not a generic "something went wrong"). Then submit a real `@arteagreenventures.com` test address and confirm it either redirects to `/home` or shows the "check your email" panel, matching whichever Supabase's email-confirmation setting produces.

- [ ] **Step 5: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "Route staff signup through the domain-gated API endpoint"
```

---

### Task 4: Admin-only client invite Route Handler

**Files:**
- Create: `src/app/api/admin/invite-client/route.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient(accessToken)` and `getSupabaseServiceClient()` from Task 1.
- Produces: `POST /api/admin/invite-client` — headers `Authorization: Bearer <access_token>`; body `{ email: string; applicationId: string }` → `200 { ok: true }` or `{ error: string }` at 400/401/403/500. Task 6's `InviteClientForm` consumes this exact shape.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/admin/invite-client/route.ts
//
// Admin-only: invites a brand-new client by email and grants them access to
// one specific application in the same request, so the two can't be
// forgotten as separate steps. inviteUserByEmail() requires the service_role
// key (bypasses RLS entirely) — everything before that call independently
// re-verifies the caller is really an admin via their OWN bearer token and
// RLS, since a service_role client can't be trusted to self-police.

import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { email?: string; applicationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const applicationId = body.applicationId?.trim() ?? "";
  if (!email || !applicationId) {
    return NextResponse.json(
      { error: "An email and application are required." },
      { status: 400 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const callerClient = getSupabaseServerClient(token);
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your session has expired — sign in again." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await callerClient
    .from("agv_profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const adminClient = getSupabaseServiceClient();
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { role: "client" },
      redirectTo: `${new URL(request.url).origin}/invite/complete`,
    }
  );
  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const invitedId = invited.user?.id;
  if (!invitedId) {
    return NextResponse.json(
      { error: "Invite sent, but couldn't confirm the new account id — grant access manually via User access." },
      { status: 500 }
    );
  }

  const { error: grantError } = await callerClient
    .from("agv_application_access")
    .insert({ application_id: applicationId, profile_id: invitedId });
  if (grantError) {
    return NextResponse.json(
      {
        error: `Invited ${email}, but the access grant failed (${grantError.message}). Grant it manually via User access.`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add the server-only env var**

In `.env.example`, after the existing "SERVICE ROLE KEY" comment block, add:

```
# Same service_role key as above, but as a real (server-only, non-public)
# runtime env var — required for the client-invite API route
# (src/app/api/admin/invite-client/route.ts), which calls Supabase's Admin
# API from inside the running app. Set this in .env.local for dev and in
# your host's project env vars for prod (e.g. Vercel → Settings →
# Environment Variables). NOT prefixed NEXT_PUBLIC_ — never exposed to the
# browser. Still never paste the actual key into a chat session.
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
```

Tell the user directly (do not attempt this yourself) that this value must be added to their own `.env.local`, and to their Vercel project's env vars before this route will work in production.

- [ ] **Step 3: Verify auth and role checks work — request a real access token first**

Sign in as admin in the browser (or via the dev QuickSwitch), then in the browser console:
```js
const { data } = await window.supabase.auth.getSession(); // or however the app exposes it — otherwise read from AccountSettings devtools
console.log(data.session.access_token);
```
(If `window.supabase` isn't exposed, temporarily add `console.log((await getSupabaseClient().auth.getSession()).data.session?.access_token)` anywhere client-side, run it once, then remove it — don't leave debug logging in.)

Then:
```bash
curl -s -X POST http://localhost:3170/api/admin/invite-client \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -d '{"email":"a-real-inbox-you-own@somewhere.com","applicationId":"<a real agv_applications uuid>"}'
```
Expected: `{"ok":true}`. Then confirm empirically (ask the user to check, or query if you have read access): the new `auth.users` row shows `invited_at` set, and a new `agv_application_access` row exists with `application_id` matching the one passed and `revoked_at` null.

Repeat with a **staff** account's access token instead of admin's:
Expected: `{"error":"Admin access required."}` at 403 — proves admin-only is enforced server-side, not just hidden in the UI.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/invite-client/route.ts .env.example
git commit -m "Add admin-only client invite route (invite + first access grant)"
```

---

### Task 5: Invite-completion page (set first password)

**Files:**
- Create: `src/app/invite/complete/page.tsx`

**Interfaces:**
- Consumes: `getSupabaseClient()` from `@/lib/supabase/client`, `roleHome` from `@/lib/session`.

- [ ] **Step 1: Write the page**

The existing `/account` password form requires re-entering a *current* password (a deliberate reauth guard for existing users changing their password) — an invited user has no password yet, so that form can't be reused as-is. This is the "real reason not to" the spec allows for skipping Supabase's bare default flow; everything else about the flow (the emailed link, establishing the session from it) still uses Supabase's own mechanism untouched.

```tsx
"use client";

// Where a freshly-invited client's email link lands. Supabase's invite
// email authenticates them and redirects here with tokens in the URL
// fragment; createBrowserClient auto-detects that (detectSessionInUrl is
// its default), so by the time this page's effect runs, a real session
// already exists — this page's only job is to ask for a first password,
// since an invited account starts with none.

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import { Wordmark } from "@/components/Logo";
import { getSupabaseClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/session";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function InviteCompletePage() {
  const router = useRouter();
  const reduced = useReducedMotionPref();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setHasSession(!!data.session);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    router.push(roleHome("client"));
  }

  return (
    <main id="main-content" className="relative flex min-h-dvh flex-col">
      <div className="flex items-center justify-between p-6 sm:p-10">
        <Wordmark />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="glass w-full max-w-md rounded-3xl p-7 text-bone backdrop-blur-2xl sm:p-9"
        >
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
            Artea Green Ventures Home
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">Set your password</h1>

          {checking ? (
            <p className="mt-4 text-sm text-ash">Checking your invite link…</p>
          ) : !hasSession ? (
            <p className="mt-4 text-sm leading-relaxed text-ash">
              This invite link is invalid or has expired. Contact your AGV
              administrator for a new invite.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ash">
                Choose a password to finish setting up your account.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="password"
                    className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="At least 8 characters"
                    className="mt-1.5 w-full rounded-xl border border-ash/20 bg-white/50 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal focus:ring-1 focus:ring-signal/40"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm"
                    className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setError(null);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-ash/20 bg-white/50 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal focus:ring-1 focus:ring-signal/40"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs leading-relaxed text-amber">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-signal py-3 text-sm font-semibold text-void transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Set password and continue"}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify with a real invite end-to-end**

This depends on Task 4 already working. Using an email address you actually own: invite it via the UI built in Task 6 (or curl, per Task 4 Step 3), open the invite email, click the link, confirm it lands on `/invite/complete` with the "Set your password" form (not the "invalid" message), set a password, and confirm it redirects to `/portal` and that a subsequent normal sign-in with that email/password works.

Note in `STATUS.md` (Task 7) if Supabase's Auth → URL Configuration → Redirect URLs allow-list needs `http://localhost:3170/invite/complete` (and the deployed prod origin's equivalent) added — the invite email's link will otherwise be rejected by Supabase before it ever reaches this page. This is a dashboard setting only the user can add.

- [ ] **Step 3: Commit**

```bash
git add src/app/invite/complete/page.tsx
git commit -m "Add invite-completion page for first-time client password setup"
```

---

### Task 6: "Invite client" UI on the application detail page

**Files:**
- Create: `src/components/admin/InviteClientForm.tsx`
- Modify: `src/components/admin/AdminApplicationView.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/invite-client` from Task 4; `findApplicationId` from `@/lib/supabase/applications` (already exported, unchanged).
- Produces: `<InviteClientForm applicationId={string} applicationReference={string} />`.

**Placement decision** (for `STATUS.md`): the button lives on the **application detail page**, not `/admin/access`. The Access Matrix page grants *existing* profiles access to applications — a not-yet-invited client has no profile row to appear in that list yet. The detail page already has the one piece of context the invite flow structurally needs (which application to grant first), so putting it here means there's no second "pick an application" step to add or forget.

- [ ] **Step 1: Write `InviteClientForm`**

```tsx
"use client";

// Admin-only "Invite client" control, shown on one application's detail
// page. Calls /api/admin/invite-client, which independently re-verifies
// admin status server-side (see that route) — this component doesn't do
// any authorization itself, only UI.

import { useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function InviteClientForm({
  applicationId,
  applicationReference,
}: {
  applicationId: string;
  applicationReference: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }

    setBusy(true);
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      if (!session) {
        setError("Your session has expired — sign in again.");
        setBusy(false);
        return;
      }

      const res = await fetch("/api/admin/invite-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: trimmed, applicationId }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      setDone(
        `Invited ${trimmed} — they'll get an email to set their password, and will see ${applicationReference} once they sign in.`
      );
      setEmail("");
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-ash/30 px-4 py-2 text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:border-signal/60 hover:text-signal"
      >
        Invite client
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-ash/15 bg-pine/40 p-5"
    >
      <p className="text-sm text-bone">
        Invite a new client and grant them {applicationReference} in one step.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="invite-email"
            className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
          >
            Client email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="client@theirdomain.com"
            className="mt-1.5 w-full rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-signal px-4 py-2.5 font-display text-sm font-bold text-void transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
              setDone(null);
            }}
            disabled={busy}
            className="rounded-md border border-ash/30 px-4 py-2.5 text-sm text-ash transition hover:text-bone disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-amber">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-contour">
          {done}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Wire it into `AdminApplicationView`**

In `src/components/admin/AdminApplicationView.tsx`:

Add the import:
```ts
import { findApplicationId } from "@/lib/supabase/applications";
import InviteClientForm from "@/components/admin/InviteClientForm";
```

Change `LoadState`'s `"ready"` variant and the load effect to also carry the resolved uuid:
```ts
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found" }
  | { status: "ready"; app: Application; applicationId: string | null };
```

```ts
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([fetchApplicationByReference(clean), findApplicationId(clean)])
      .then(([app, applicationId]) => {
        if (cancelled) return;
        setState(app ? { status: "ready", app, applicationId } : { status: "not-found" });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Something went wrong loading this application.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [clean, accountId]);
```

(The three `handleStageChange`/`handleAddNote`/`handleUploadDocument` refetch calls that build `{ status: "ready", app }` need the same treatment — update each to also resolve and include `applicationId`, e.g. `const [app, applicationId] = await Promise.all([fetchApplicationByReference(clean), findApplicationId(clean)]); if (app) setState({ status: "ready", app, applicationId });`.)

Render the form above `ApplicationDetail`, only once `applicationId` resolved:
```tsx
      {state.status === "ready" ? (
        <div className="mt-8 space-y-6">
          {state.applicationId && (
            <InviteClientForm
              applicationId={state.applicationId}
              applicationReference={clean}
            />
          )}
          <ApplicationDetail
            app={state.app}
            canEdit
            onStageChange={handleStageChange}
            onAddNote={handleAddNote}
            onUploadDocument={handleUploadDocument}
          />
        </div>
      ) : state.status === "loading" ? (
```

- [ ] **Step 3: Verify in the browser**

Sign in as admin, open any application detail page (`/admin/applications/AGV-2026-0118` or similar), confirm the "Invite client" button renders above the application detail card, click it, submit a real email you own, and confirm the success message renders with the correct application reference. Then repeat Task 4 Step 3's negative case from the UI itself if possible (harder to force from the UI since it's admin-only-rendered — the curl check in Task 4 already covers server-side enforcement).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/InviteClientForm.tsx src/components/admin/AdminApplicationView.tsx
git commit -m "Add Invite client UI to the application detail page"
```

---

### Task 7: Overwrite STATUS.md

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Overwrite using the project's standard template**, reporting real results from Tasks 1–6's verification steps (which bugs were found, if any; whether the redirect-URL dashboard setting was needed; whether email delivery was confirmed or only `invited_at` was checked). Use this shape:

```markdown
# AGV Portal — Status
Updated: <real date>
Phase: Onboarding model — domain-restricted staff signup + client invites
State: <in progress / complete / blocked>

## Done this session
## Files added/changed
## Decisions made
## Known issues / TODO
## Blocked on / needs a decision
## Next step
```

Decisions to carry into the doc: the "Invite client" placement rationale (Task 6), the choice not to implement the Postgres "before user created" hook (Global Constraints above), and the choice to build a minimal `/invite/complete` page instead of relying on the existing `/account` password form (Task 5).

Known issues to carry into the doc: the still-pending `20260724100000_fix_new_user_default_role.sql` migration from last session (now doubly relevant since it also affects what a metadata-less signup would default to), and the Supabase Auth redirect-URL allow-list requirement for `/invite/complete` if Task 5's end-to-end test needed it.

- [ ] **Step 2: Commit**

```bash
git add STATUS.md
git commit -m "Update STATUS.md for the onboarding model work"
```

---

## Self-Review Notes

- **Spec coverage:** domain check (Task 2/3), server-side enforcement not just client (Task 2 — the actual `signUp()` call is server-side), native-allowlist check (Global Constraints, researched and documented), invite UI placement + rationale (Task 6, explained for STATUS.md), admin-only (route-enforced in Task 4, UI-only-rendered in Task 6), service_role isolation (Task 1's file boundary), invite + grant bundled (Task 4, single request), Supabase's own invite-link flow reused except for the justified password-setup exception (Task 5), `/signup` ungated (Task 3 verifies, no change needed), empirical proof of all three "when done" bullets (Task 2 Steps 2–3, Task 4 Step 3, Task 5 Step 2).
- **Placeholder scan:** every step has real, complete code; no "TBD"/"add validation later" left in.
- **Type consistency:** `LoadState`'s `"ready"` variant gains `applicationId: string | null` in Task 6 and every state-setting call site in `AdminApplicationView.tsx` is updated to match, not just the initial load effect.
