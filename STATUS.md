# AGV Portal — Status
Updated: 2026-07-24
Phase: Onboarding model — self-serve signup, domain-branched staff/client
State: In progress — code complete, build/lint clean, most of it live-verified. One check (the client self-signup path end-to-end) is blocked on an env var only you can add. See "Blocked on" below.

## Done this session
Started as an admin-invite-only client model (per an earlier brief), then pivoted mid-build after a real incident: Supabase emailed a bounce-rate warning on this project, caused by my own test signups using fabricated addresses at `arteagreenventures.com` during verification. Rather than build a client flow that still depends on Supabase's default mailer at any real volume, the model is now:

- **Staff** (`@arteagreenventures.com` email) — self-signup at `/signup`, unchanged from before: a real `signUp()` call, Supabase sends its usual verification link, role defaults to `staff`.
- **Clients** (any other email) — self-signup at the *same* `/signup` form. The route creates the account via the Admin API (`auth.admin.createUser({ email_confirm: true, ... })`), which marks the account already-verified **without Supabase ever attempting to send anything** — confirmed via Supabase's own docs before relying on it, not assumed. This path structurally cannot bounce, regardless of whether the email is real. Clients still start with **zero application access** — an admin grants it afterward via the existing `/admin/access` page, unchanged.

**The admin-invite flow built earlier this session (`/api/admin/invite-client`, `/invite/complete`, the "Invite client" button) was fully removed** — deleted, not deprecated, with `AdminApplicationView.tsx` reverted to its pre-invite state. `grep` confirms no dangling references anywhere in `src/`.

**Verified so far:**
- `npm run build` and `npm run lint` both pass clean.
- Validation layer (shared by both branches): malformed JSON, missing fields, and a malformed email shape all correctly rejected with clear messages, before ever calling Supabase — checked live via curl.
- Domain-reject/accept logic for the staff branch was proven earlier this session (before the pivot) with two real `@arteagreenventures.com` signups — one of those accounts is real leftover from that testing (see Known issues).
- **Rate limiting, added during review**: client-signup uses the `service_role` key, which bypasses Supabase's own signup throttling entirely — an unlimited public endpoint for account creation was a real gap, not a hypothetical one. Added a per-IP limiter (5 attempts / 10 minutes); verified live via curl that the 6th rapid attempt from the same IP gets a 429, not a 500 or a silent pass-through.
- The try/catch hardening added around both branches was proven by accident, positively: with `SUPABASE_SERVICE_ROLE_KEY` missing (see Blocked on), the client-signup path failed exactly as expected — a clean `{"error": "Missing SUPABASE_SERVICE_ROLE_KEY..."}` at 500, not a crash or an HTML error page.

**Not yet verified:** the client-signup path's actual success case (does `createUser` + immediate `signInWithPassword` + session hydration really work end-to-end, and does the resulting account genuinely start with zero visible applications). Needs the env var below.

## Files added/changed
- `src/lib/supabase/server.ts` — server-only Supabase clients (anon-scoped-to-caller, and `service_role`). Unchanged by the pivot; still exactly what the client-signup path needs.
- `src/app/api/auth/signup/route.ts` — rewritten to branch by email domain instead of rejecting non-AGV emails outright; added the per-IP rate limiter.
- `src/app/signup/page.tsx` — copy now addresses both audiences; redirects based on the role the route resolved (`staff` → `/home`, `client` → `/portal`) instead of always assuming staff.
- `.env.example` — `SUPABASE_SERVICE_ROLE_KEY` documented as a real runtime var, now used by the signup route's client-creation path (not an invite route, which no longer exists).
- Removed: `src/app/api/admin/invite-client/route.ts`, `src/app/invite/complete/page.tsx`, `src/components/admin/InviteClientForm.tsx`. `AdminApplicationView.tsx` reverted to its pre-invite version.

## Decisions made
- **No email verification for clients, by design.** This means anyone can register a client account under an email address they don't actually own — there's no proof-of-ownership step. The mitigating control is that a fresh client account has zero application access regardless; an admin must still consciously grant it via `/admin/access`. That grant is the real trust checkpoint now, not an email round-trip — which means admins should confirm out-of-band (a call, an existing thread) that they're granting access to the actual right person before doing so, since the registered email alone doesn't prove identity.
- **Rate limiting is in-memory and single-instance**, not a distributed guarantee — good enough to stop casual scripted abuse on a demo-scale deployment, disclosed as a real limit rather than a solved problem. A production deployment with real invite/signup volume should move to a proper distributed limiter (e.g. Upstash) if abuse becomes a concern.
- **Two real leftover test accounts exist from before the pivot**: `realstaffer.verify@arteagreenventures.com` and `browsertest.verify@arteagreenventures.com`, both created via real `signUp()` calls against addresses that don't exist, both still unconfirmed (their verification links were never clicked, since I don't own those mailboxes). These are very likely part of what triggered Supabase's bounce warning. Not deleted by me — deleting `auth.users` rows is a destructive action outside what I should do unilaterally. Worth removing from Supabase's dashboard (Authentication → Users) at your convenience.

## Known issues / TODO
- `20260724100000_fix_new_user_default_role.sql` (from the previous session) is still unapplied. Doesn't block either signup path today, since both always pass `role` explicitly in metadata — but it's still a real, valid fix for the trigger's stale default.
- No test framework exists in this repo; all verification above is empirical (curl, build, lint), matching this project's established convention.
- Account enumeration: a signup attempt against an already-registered email returns a different error than success, which technically confirms whether an address has an account. Consistent with how most signup forms behave; not treated as a blocker here.

## Blocked on / needs a decision
- **`SUPABASE_SERVICE_ROLE_KEY` still isn't set in `.env.local`.** Per this project's standing rule, I don't handle or see that key — please add it yourself (same value used for the seed scripts) and let me know. Once it's there I can finish verifying the client-signup path live: a real account created with zero email sent, a real session established, and confirmation that the new client genuinely sees no applications until one is granted.
- Whether to invest in custom SMTP (Resend/Postmark/SendGrid) instead of Supabase's default mailer for the staff path — not urgent at today's likely volume, worth revisiting if staff signups become frequent.

## Next step
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, tell me it's done, and I'll finish the live client-signup verification and report back with real evidence, same as everything else above.
