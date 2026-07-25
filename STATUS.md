# AGV Portal — Status
Updated: 2026-07-25
Phase: Auth hardening — Batch C (OAuth). Azure/Microsoft wired and code-verified; Google not started.
State: Azure OAuth code is in and passes build/lint/typecheck. A live privilege-escalation hole found along the way is fixed and verified. Real end-to-end Microsoft sign-in still needs a manual pass in an external browser (Chrome/Edge/Firefox) — not tested here, see Known issues.

## Done this session

### Critical fix: self-service role escalation (unrelated to OAuth, found while building it)
- `agv_profiles`'s own-row UPDATE policy (`auth.uid() = id`) checked row ownership only, not which columns changed. Any signed-in user — including a brand-new self-registered signup — could PATCH their own `role` straight to `'admin'` from the browser with two lines of JS. Predates this session entirely; every account was exposed to it.
- Fixed with a `BEFORE UPDATE` trigger (`agv_prevent_self_role_escalation`) that rejects any change to `role`/`organization_id` unless the actor is already an admin or has no JWT subject at all (the service-role key's signature) — migration `supabase/migrations/20260725100000_prevent_role_escalation.sql`, applied directly by the user via the Supabase SQL editor, migration file committed at `7fbf57a`.
- Verified via curl against the live project: a fresh test account's self-escalation attempt now returns `400` / `"Only admins may change role or organization_id."`; a legitimate self-update (name) still returns `200`. Confirmed the stored role stayed `client` throughout, test account deleted afterward.

### Azure (Microsoft) OAuth
- **Azure app registration** (user-side, in the Azure Portal): multi-tenant + personal accounts (`Accounts in any organizational directory and personal Microsoft accounts`), redirect URI `https://bcblmpwguqmouqxdswxj.supabase.co/auth/v1/callback`, client secret created. Client ID: `aaedca45-553e-4783-9b06-68064a49fafc`.
- **Supabase provider config** (user-side, dashboard → Authentication → Providers → Azure): enabled, Client ID + Secret entered, **Azure Tenant URL left blank** (blank = Supabase's `common` endpoint = any tenant + personal accounts, matching the multi-tenant registration above — typing `common` literally is rejected as "not a valid URL").
- **Design decision — multi-tenant, not staff-only**: chosen deliberately so clients can also authenticate with their own Microsoft accounts, as a real proof-of-mailbox-ownership signal the existing client signup path (`admin.createUser({ email_confirm: true })`) doesn't provide today. Known gap: this only covers clients who happen to use a Microsoft account — Gmail/other clients still go through the unverified password path. Not fixed this session; flagged as a possible follow-up (a Google provider, or switching the password client-path to a real confirmation email).
- **Code**:
  - `src/lib/session.ts` — added `signInWithOAuth(provider)`, currently typed to `"azure"` only (extendable when Google is added). Redirects to `${origin}/auth/callback`.
  - `src/app/auth/callback/route.ts` (new) — exchanges the OAuth `code` for a session using `@supabase/ssr`'s cookie-backed server client (already a dependency; same package `client.ts` uses). Since Azure is now multi-tenant, it can no longer be trusted to imply staff — so on a **brand-new account only** (detected via `created_at` ≈ `last_sign_in_at`, within 30s), the callback resolves role by email domain and corrects `agv_profiles.role` using the service-role client (the one legitimate exception to the RLS fix above — service-role requests have no JWT subject, which the trigger explicitly allows through). Deliberately does **not** touch role on later logins, so an admin (or anyone else with a manually-set role) who later chooses "Continue with Microsoft" instead of a password can't get silently downgraded.
  - `src/app/page.tsx` and `src/app/signup/page.tsx` — added a "Continue with Microsoft" button (own Microsoft-brand icon, no new dependency) below the existing form on both. Sign-in page also picks up `?error=oauth` (set by the callback on any failure) and shows an inline error, same visual language as the password-path errors.
- **Verification done**: `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean (`/auth/callback` builds as a dynamic route, as expected for a Route Handler). Confirmed via the dev server that both buttons render correctly (accessibility tree, not a click-through) on `/` and `/signup`.
- **Verification NOT done / can't be done here**: the actual Microsoft login screen. Per the standing rule from the CAPTCHA work, Claude Desktop's embedded Browser pane isn't used for pages that hand off to a real external identity provider — clicking "Continue with Microsoft" through it isn't something this session attempted. See Next step.

## Files added/changed
- `supabase/migrations/20260725100000_prevent_role_escalation.sql` — new, committed `7fbf57a`.
- `src/app/auth/callback/route.ts` — new.
- `src/lib/session.ts`, `src/app/page.tsx`, `src/app/signup/page.tsx` — OAuth button + `signInWithOAuth` wiring.

## Decisions made
- Multi-tenant Azure (any org + personal accounts), not staff-only single-tenant — see "Design decision" above.
- Role is resolved from email domain only at first-ever OAuth login, never re-derived on subsequent logins, to avoid clobbering an admin's role if they later use Microsoft sign-in.
- The RLS fix's allowance for "no JWT subject" (service-role requests) rather than a narrower allowlist — matches how every other server-side privileged write in this app already works (`getSupabaseServiceClient()`), no new pattern introduced.

## Known issues / TODO
- **Not yet tested end-to-end**: a real "Continue with Microsoft" click, through both an AGV account and a non-AGV Microsoft account, needs to happen in a real external browser (Chrome/Edge/Firefox) — confirming: (a) the redirect round-trip actually completes, (b) an AGV email lands as staff at `/home`, (c) a non-AGV Microsoft/personal account lands as client at `/portal`, (d) the account's `agv_profiles.role` is correct afterward.
- **Supabase redirect URL allowlist**: Authentication → URL Configuration → Redirect URLs needs `http://localhost:3170/auth/callback` added for local dev (this app's dev port, per `.claude/launch.json` — not 3000), plus the production domain's `/auth/callback` once deployed. Not yet confirmed done.
- **Client email-verification gap**: multi-tenant Microsoft OAuth only proves mailbox ownership for clients who use a Microsoft account; other clients still go through the zero-verification password path. Flagged, not addressed.
- Google OAuth (the other half of Batch C) not started.

## Blocked on / needs a decision
Needs the user to: (1) add the redirect URLs to Supabase's allowlist if not already done, (2) run the real end-to-end Microsoft sign-in test in an external browser and report back what happened, (3) confirm whether to proceed to Google OAuth next or hold until Azure is confirmed working live.

## Next step
User runs the real Microsoft sign-in test (both an AGV account and a personal/other-org Microsoft account) in Chrome/Edge/Firefox against `http://localhost:3170`, reports results back. Once Azure is confirmed working, move on to Google OAuth using the same pattern (`signInWithOAuth`, same callback route, extend the `OAuthProvider` type).
