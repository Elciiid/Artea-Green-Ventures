# AGV Portal — Status
Updated: 2026-07-25
Phase: Auth hardening — Batch C (OAuth). Azure/Microsoft confirmed working end-to-end. Google not started (walkthrough given, waiting on the user's Google Cloud Console setup).
State: Real Microsoft sign-in works — verified live, not just build-clean. A live privilege-escalation hole found along the way is fixed and verified. Two real bugs surfaced during first end-to-end testing and are fixed; details below.

## Done this session

### Critical fix: self-service role escalation (unrelated to OAuth, found while building it)
- `agv_profiles`'s own-row UPDATE policy (`auth.uid() = id`) checked row ownership only, not which columns changed. Any signed-in user — including a brand-new self-registered signup — could PATCH their own `role` straight to `'admin'` from the browser with two lines of JS. Predates this session entirely; every account was exposed to it.
- Fixed with a `BEFORE UPDATE` trigger (`agv_prevent_self_role_escalation`) that rejects any change to `role`/`organization_id` unless the actor is already an admin or has no JWT subject at all (the service-role key's signature) — migration `supabase/migrations/20260725100000_prevent_role_escalation.sql`, applied directly by the user via the Supabase SQL editor, migration file committed at `7fbf57a`.
- Verified via curl against the live project: a fresh test account's self-escalation attempt now returns `400` / `"Only admins may change role or organization_id."`; a legitimate self-update (name) still returns `200`.

### Azure (Microsoft) OAuth — working, verified live
- **Azure app registration**: multi-tenant + personal accounts (`Accounts in any organizational directory and personal Microsoft accounts`), redirect URI `https://bcblmpwguqmouqxdswxj.supabase.co/auth/v1/callback`, Web platform (not SPA — confirmed, this matters because SPA registrations reject the client secret Supabase sends during token exchange). Client ID: `aaedca45-553e-4783-9b06-68064a49fafc`.
- **Token configuration → optional claim**: added `email` as an ID-token optional claim (+ the Graph permission Azure prompted alongside it). Required for personal Microsoft accounts specifically — Graph's `/me.mail` field is frequently null for personal outlook.com/hotmail accounts, which was the last real blocker (see Known issues resolved, below).
- **Supabase provider config**: enabled, Client ID + Secret (the actual Value, not the Secret ID — an early mistake, since fixed) entered, Azure Tenant URL set explicitly to `https://login.microsoftonline.com/common` (tried blank first per Supabase's documented default; setting it explicitly is what's now live, left as-is since it works — the blank-vs-explicit distinction was never conclusively isolated as the fix, see Decisions made).
- **Design decision — multi-tenant, not staff-only**: deliberate, so clients can also authenticate with their own Microsoft accounts as a real proof-of-mailbox-ownership signal the existing client signup path (`admin.createUser({ email_confirm: true })`) doesn't provide. Known gap, not addressed this session: this only covers clients who happen to use a Microsoft account — other clients still go through the unverified password path.
- **Code**:
  - `src/lib/session.ts` — `signInWithOAuth(provider)`, typed to `"azure"` only for now. Also: `loadAccount()` now wraps `getUser()` and the profile query in try/catch (previously unguarded — a thrown error there silently rejected the promise driving `hydrated`, stranding the app on the loading screen forever, which is what a first real OAuth round-trip surfaced as a "white screen" bug).
  - `src/app/auth/callback/route.ts` — exchanges the OAuth code for a session via `@supabase/ssr`'s cookie-backed server client. Resolves role by email domain on brand-new accounts only (`created_at` ≈ `last_sign_in_at`), using the service-role client — never touches role on later logins, so an admin signing in via Microsoft later can't get silently downgraded. Keeps diagnostic `console.error` logging on both failure paths (worth keeping permanently, not just for this session — it's what surfaced all three real failures below via Supabase's `error`/`error_description` redirect params, which are otherwise invisible).
  - `src/app/page.tsx`, `src/app/signup/page.tsx` — "Continue with Microsoft" button on both.
- **Real failures hit and fixed, in order** (all via the same generic "Something went wrong signing in with Microsoft" surfaced to the user, root cause only visible in dev-server logs):
  1. Wrong client secret (Secret ID pasted instead of the Value) — fixed by regenerating and re-pasting correctly.
  2. `"Error getting user email from external provider"` — Graph's `/me.mail` was null for the personal-account test login. Fixed via the Token configuration optional `email` claim (above).
  3. A white-screen-after-login bug, unrelated to Azure/Supabase config — the `loadAccount()` unguarded-throw bug (above), which this was the first flow in the app to ever exercise (the password path never round-trips a session through a server-set cookie the way OAuth does).
- **Verified live**: real Microsoft sign-in completes end-to-end against the dev server. `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean throughout.

## Files added/changed
- `supabase/migrations/20260725100000_prevent_role_escalation.sql` — new, committed `7fbf57a`.
- `src/app/auth/callback/route.ts` — new.
- `src/lib/session.ts`, `src/app/page.tsx`, `src/app/signup/page.tsx` — OAuth button + `signInWithOAuth` wiring, plus the `loadAccount()` hardening.

## Decisions made
- Multi-tenant Azure (any org + personal accounts), not staff-only single-tenant.
- Role resolved from email domain only at first-ever OAuth login, never re-derived later.
- Diagnostic logging in `auth/callback/route.ts` is staying in permanently, not being cleaned up — it's the only way any of the three real failures above were diagnosable, and Google will likely hit its own first-run surprises the same way.
- Azure Tenant URL is explicitly `https://login.microsoftonline.com/common` rather than blank. Not conclusively proven this mattered (the email-claim fix landed around the same time), but it's working, so left as-is rather than re-testing blank just to find out.

## Known issues / TODO
- **Client email-verification gap**: multi-tenant Microsoft OAuth only proves mailbox ownership for clients who use a Microsoft account; other clients still go through the zero-verification password path. Flagged, not addressed.
- Google OAuth not started — user is registering the Google Cloud Console app first (walkthrough given: OAuth consent screen as External, Web application OAuth client, same Supabase callback URL). Waiting on the Client ID.
- Real end-to-end testing so far covers Azure only; Google will need the same live-login pass once wired.

## Blocked on / needs a decision
Waiting on the user's Google Cloud Console Client ID to wire Google OAuth using the same pattern.

## Next step
User finishes Google Cloud Console setup (OAuth consent screen + Web OAuth client), sends back the Client ID. Then: extend `OAuthProvider` to include `"google"`, add the button, confirm the Supabase Google provider is configured, and do a real end-to-end test the same way Azure was verified.
