# AGV Portal — Status
Updated: 2026-08-03
Phase: Isolated bug-fix branch `fix-signin-error-masking` — two auth error-masking fixes, off `main` @ `eeaa8a9`.
State: Kokonut UI Adoption and everything before it is done and was reported in full in an earlier chat — not repeated here. Nothing pushed or merged to `main`. Live at `https://portal.arteagreenventures.com`, unaffected by anything in this file.

This branch sits alongside three other unmerged branches (`review-fixes`, `harden-fixes`, and the `branch-reconciliation` integration branch that merges the two of them plus live-verification and doc prep — all previously reported) — see "Branches awaiting review" below for how they relate.

## Production sign-in diagnosis (2026-08-03)

A sign-in failure surfaced while live-verifying `branch-reconciliation`. Diagnosed with real evidence rather than guessing:

- **Symptom:** login showed "That email and password don't match an account," with zero console errors and zero network requests ever reaching Supabase.
- **Root cause:** the test worktree's first production build (`next build`) ran before `.env.local` existed in that worktree, baking in `undefined` for `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `getSupabaseClient()` throws a clear error for this, but `page.tsx`'s `onSubmit` unconditionally overwrote *any* sign-in error with the generic "don't match" message — masking a config error as a bad password.
- **Ruled out:** Supabase's Site URL/Redirect URL allowlist — confirmed via direct `curl` against the `/auth/v1/token` endpoint that plain password-grant auth was completely healthy; that config only governs OAuth/magic-link redirects, never password sign-in.
- **Confirmed unaffected:** the real deployed site (`https://portal.arteagreenventures.com`) signed in cleanly with the same demo account — this was entirely a local test-rig artifact, never a production or Supabase-config defect. Nothing was changed in the app or in Supabase's dashboard config as a result of the diagnosis itself.

## Branch `fix-signin-error-masking` — two fixes, done and live-verified

The generic-error-message masking found during the diagnosis above turned out to be a small recurring bug class. Fixed on its own isolated branch (not folded into `branch-reconciliation`), two commits:

1. **Sign-in + password-change reauth (`73a7d21`).** `signIn()` (`src/lib/session.ts`) and `AccountSettings.tsx`'s password-change reauth both flattened every `signInWithPassword` failure — including the missing-env-var case above, network failures, rate limiting — into one generic "wrong password" message. Added `isInvalidCredentialsError()`, which checks GoTrue's own `invalid_credentials` error code: genuine wrong-password cases still get the existing safe, generic message (deliberate — not revealing whether an email exists is correct security practice, left unchanged); everything else now gets a distinct, honest message and is logged to the console via `console.error`.
2. **MFA verification (`85a336a`).** `AccountSettings.tsx`'s TOTP `challengeAndVerify()` had the identical pattern — any failure (expired challenge, IP mismatch, rate limiting) showed "That code didn't match," not just a genuine wrong code. Added `isMfaVerificationFailedError()` (GoTrue's `mfa_verification_failed` code) the same way.

**Verified live, not just by type-checking:**
- Regression: a real wrong password against a real demo account still shows the exact original message, no console noise.
- The actual fix: removed `.env.local`, rebuilt, reproduced the original bug, confirmed the UI now shows a distinct message and the console shows the real "Missing NEXT_PUBLIC_SUPABASE_URL..." error with a full stack trace. Restored `.env.local`, reconfirmed normal sign-in.
- MFA: signed up a throwaway test account (seed/demo accounts are deliberately excluded from MFA), enrolled a real TOTP factor, computed real codes locally. A wrong code still shows the original message with no console noise; the correct code completes enrollment normally. Deleted the test account afterward via the service role key — nothing left behind in Supabase.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean after both commits.

Not fixed (out of scope, flagged only): `AccountSettings.tsx`'s MFA *enrollment/removal* error handling and other catch blocks already forward their real error message rather than flattening it — no recurrence found there. `signup/page.tsx` and its API route were checked too — no recurrence.

## Branches awaiting review

- `review-fixes` (off `main` @ `eeaa8a9`, 10 commits) — senior front-end review fixes (WCAG contrast, `revokeAccess` guard, shared async/error-state components, admin self-demotion security fix, an integration test).
- `harden-fixes` (off `main` @ `eeaa8a9`, 8 commits) — the `/impeccable harden` bucket (demo-colophon gating, RoleChangeDialog pre-select fix, heading hierarchy, focus rings, token/press-transform consistency, form a11y wiring).
- `branch-reconciliation` (off `main` @ `eeaa8a9`) — integration branch merging the two branches above, with the `RoleChangeDialog.tsx` conflict reconciled (not picked one-sided), live-verified end to end, and `PRODUCT.md`/`DESIGN.md`/`.impeccable/design.json`/`FRONTEND_REVIEW.md` prepped (not committed) for review.
- `fix-signin-error-masking` (off `main` @ `eeaa8a9`, 2 commits, this branch) — the two fixes above. Not yet merged into `branch-reconciliation`.

All four branch from the same commit and are independent of each other except where noted (`RoleChangeDialog.tsx` overlap between `review-fixes`/`harden-fixes`, already reconciled on `branch-reconciliation`).

## Known issues carried forward (still open, not part of any pass above)

- The orphaned duplicate `auth.users` account (no `agv_profiles` row) flagged in an earlier phase is still unresolved.
- Google OAuth remains separately pending.
- `Tabs`'s `orientation` prop isn't forwarded to `TabsPrimitive.Root` (upstream registry quirk) — irrelevant so far, only horizontal orientation is used.
- The Roles/Directory person-select dropdown positioning bug reported in an earlier phase never reproduced in this session's tooling — still open, blocked on a real screenshot or more precise repro steps.
