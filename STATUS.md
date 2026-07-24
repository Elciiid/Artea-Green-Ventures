# AGV Portal — Status
Updated: 2026-07-24
Phase: Onboarding model — self-serve signup, domain-branched staff/client
State: Complete — code, build, lint, and every empirical check in this session's brief all pass. No open blockers.

## Done this session
Started as an admin-invite-only client model (per an earlier brief), then pivoted mid-build after a real incident: Supabase emailed a bounce-rate warning on this project, caused by my own test signups using fabricated addresses at `arteagreenventures.com` during verification. Rather than build a client flow that still depends on Supabase's default mailer at any real volume, the model is now:

- **Staff** (`@arteagreenventures.com` email) — self-signup at `/signup`, unchanged from before: a real `signUp()` call, Supabase sends its usual verification link, role defaults to `staff`.
- **Clients** (any other email) — self-signup at the *same* `/signup` form. The route creates the account via the Admin API (`auth.admin.createUser({ email_confirm: true, ... })`), which marks the account already-verified **without Supabase ever attempting to send anything** — confirmed via Supabase's own docs before relying on it, not assumed. This path structurally cannot bounce, regardless of whether the email is real. Clients still start with **zero application access** — an admin grants it afterward via the existing `/admin/access` page, unchanged.

**The admin-invite flow built earlier this session (`/api/admin/invite-client`, `/invite/complete`, the "Invite client" button) was fully removed** — deleted, not deprecated, with `AdminApplicationView.tsx` reverted to its pre-invite state. `grep` confirms no dangling references anywhere in `src/`.

**`20260724100000_fix_new_user_default_role.sql` (carried over from the previous session) has now been applied by the user, confirmed successful.** The `agv_handle_new_user()` trigger's role default is fixed at the database level too — belt-and-suspenders alongside both signup branches already passing `role` explicitly.

**Fully verified, end to end:**
- `npm run build` and `npm run lint` both pass clean.
- Validation layer (shared by both branches): malformed JSON, missing fields, and a malformed email shape all correctly rejected with clear messages, before ever calling Supabase — checked live via curl.
- Staff domain-reject/accept logic was proven earlier this session (before the pivot) with two real `@arteagreenventures.com` signups — see Known issues for the cleanup this left behind.
- **Rate limiting**, added during review after noticing client-signup uses the `service_role` key and bypasses Supabase's own signup throttling entirely — a real gap, not hypothetical. Added a per-IP limiter (5 attempts / 10 minutes); verified live via curl that the 6th rapid attempt from the same IP gets a 429, not a 500 or a silent pass-through.
- Try/catch hardening around both branches proved itself: while `SUPABASE_SERVICE_ROLE_KEY` was still missing, the client-signup path failed exactly as designed — a clean `{"error": "Missing SUPABASE_SERVICE_ROLE_KEY..."}` at 500, never a crash or an HTML error page.
- **Client signup, full path, real evidence**: with the key in place, created a real client account (`browserclienttest.demo@othercompany.example`) via curl, then again through the actual `/signup` UI in the browser. Confirmed via the decoded session cookie: correct email, `role: "client"`, `email_verified: true` — proving the account was created already-verified with no email round-trip. The browser redirected straight to `/portal`, which rendered "You have access to 0 applications... Ask an administrator to grant you access" — the expected zero-access state for a brand-new, ungranted client.

## Files added/changed
- `src/lib/supabase/server.ts` — server-only Supabase clients (anon-scoped-to-caller, and `service_role`).
- `src/app/api/auth/signup/route.ts` — branches by email domain instead of rejecting non-AGV emails outright; includes the per-IP rate limiter.
- `src/app/signup/page.tsx` — copy now addresses both audiences; redirects based on the role the route resolved (`staff` → `/home`, `client` → `/portal`).
- `.env.example` — `SUPABASE_SERVICE_ROLE_KEY` documented as a real runtime var, used by the signup route's client-creation path.
- Removed: `src/app/api/admin/invite-client/route.ts`, `src/app/invite/complete/page.tsx`, `src/components/admin/InviteClientForm.tsx`. `AdminApplicationView.tsx` reverted to its pre-invite version.

## Decisions made
- **No email verification for clients, by design.** Anyone can register a client account under an email address they don't actually own — there's no proof-of-ownership step. The mitigating control is that a fresh client account has zero application access regardless; an admin must still consciously grant it via `/admin/access`. That grant is the real trust checkpoint now, not an email round-trip — admins should confirm out-of-band (a call, an existing thread) that they're granting access to the actual right person, since the registered email alone doesn't prove identity.
- **Rate limiting is in-memory and single-instance**, not a distributed guarantee — good enough to stop casual scripted abuse on a demo-scale deployment, disclosed as a real limit rather than a solved problem. A production deployment with real signup volume should move to a proper distributed limiter (e.g. Upstash) if abuse becomes a concern.
- **Two real leftover test accounts exist from before the pivot**: `realstaffer.verify@arteagreenventures.com` and `browsertest.verify@arteagreenventures.com`, both created via real `signUp()` calls against addresses that don't exist, both still unconfirmed. Very likely part of what triggered Supabase's bounce warning. Not deleted by me — deleting `auth.users` rows is destructive and outside what I should do unilaterally. A third test account, `browserclienttest.demo@othercompany.example`, was also created this session via the client path — harmless (no email was ever sent for it), but also sitting in `auth.users` if you want a clean slate.

## Known issues / TODO
- No test framework exists in this repo; all verification above is empirical (curl, browser, build, lint), matching this project's established convention.
- Account enumeration: a signup attempt against an already-registered email returns a different error than success, which technically confirms whether an address has an account. Consistent with how most signup forms behave; not treated as a blocker here.
- Leftover test accounts noted above — worth clearing from Supabase Dashboard → Authentication → Users at your convenience.

## Blocked on / needs a decision
- Whether to invest in custom SMTP (Resend/Postmark/SendGrid) instead of Supabase's default mailer for the staff path — not urgent at today's likely volume, worth revisiting if staff signups become frequent.

## Next step
Nothing blocking. Optional cleanup: remove the three leftover test accounts from Supabase's dashboard. Otherwise this is ready to use — a client can register today and an admin can grant them access via the existing `/admin/access` page.
