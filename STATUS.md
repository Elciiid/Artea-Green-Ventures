# AGV Portal — Status
Updated: 2026-08-03
Phase: Branch reconciliation — merging `review-fixes` + `harden-fixes` + `fix-signin-error-masking` on integration branch `branch-reconciliation`, live-verifying, prepping docs for review
State: Kokonut UI Adoption (Slices 0–5) and everything before it is done and was reported in full in an earlier chat — not repeated here. Nothing pushed or merged to `main` yet. Live at `https://portal.arteagreenventures.com`.

## Impeccable setup

Installed the `impeccable` design skill globally (`~/.claude/skills/impeccable`) and ran its setup on this project: wrote `PRODUCT.md` (product truth — users, roles, per-application access-grant model) and `DESIGN.md` + `.impeccable/design.json` (visual system — Creative North Star "The Canopy Registry": warm forest palette, glass-first depth, one accent color, tactile press/focus feedback; documents the full color/typography/component vocabulary already implemented). **These three sit untracked on `main` — not yet committed, awaiting the user's own review first.** `FRONTEND_REVIEW.md` (the source document behind this whole critique/audit/harden cycle) was also found still untracked on `main` with no commit history on any branch — flagged, not caused by this pass.

## Critique + audit (whole app)

`/impeccable critique` (dual-agent: an isolated LLM design review plus a detector/browser-evidence pass) and `/impeccable audit` (single-context technical scan) both ran against the whole app. Combined score: critique 23/40 ("Acceptable"), audit 14/20 ("Good"). Full critique report persisted at `.impeccable/critique/2026-08-01T04-41-43Z__the-whole-app.md`.

Findings were consolidated into one backlog and mapped to the specific `/impeccable` command that addresses each — no speculative sweeps with commands that had no evidenced finding behind them (`bolder`/`animate`/`overdrive`/`colorize`/`typeset`/`distill`/`onboard`/`delight` were all explicitly skipped: nothing in either pass called for them, and running them would have worked against `DESIGN.md`'s own documented restraint).

Deferred, not done yet: `/impeccable polish` (login/signup consistency at the design level, `.glass`-over-flat-background), `/impeccable clarify` (Access matrix per-application visibility), `/impeccable adapt` (touch-target sizing), `/impeccable optimize` (`ApplicationDetail`'s missing pending-guard pattern) — scoped out per the user's explicit choice to do `harden` first, in isolation.

## Branch `harden-fixes` — complete, merged in, awaiting review

Isolated worktree at `.worktrees/harden-fixes`, off `main` @ `eeaa8a9`. Executed the `/impeccable harden` bucket — 7 findings across 6 subagent-driven tasks, each independently task-reviewed, plus a final whole-branch review:

1. Gated the hardcoded "Demo record, not an official document" colophon on `ApplicationDetail.tsx` behind `showDevTools()` (matching `AppShell.tsx`'s existing pattern) — this was shipping unconditionally to real clients in production before this fix.
2. Fixed `RoleChangeDialog`'s blank pre-select bug (Radix's `onOpenChange` never fires for an externally-driven `open` prop, so the effect that should seed the current role never ran) and added an inline warning when the pending selection is `admin`.
3. Promoted the People area's per-tab label (`PeopleSectionHeading`) from a `<span>` to a real `<h2>`, and `PersonDirectory`'s group titles from `<h2>` to `<h3>`, giving Directory/Access/Activity their own heading identity under the shared page `<h1>` — screen-reader heading navigation previously couldn't distinguish the three tabs.
4. Added a visible `focus-within` ring (reusing the app's standard signal-color ring tokens) to the document-upload control on Application Detail, previously invisible to keyboard-only users.
5. Migrated Login/Signup off 11 hardcoded `bg-white/NN` values onto the `pine` token, and swapped their 4 `active:scale-[0.99]` button presses for the system-standard `active:translate-y-px` — the two most-seen pages in the app had never gone through the earlier Kokonut/shadcn token migration.
6. Wired `aria-invalid`/`aria-describedby` on Login/Signup/Account-Settings/MFA form inputs, so screen-reader users tabbing back to a failed field get an in-context signal, not just a one-time announcement.

**Final whole-branch review caught two real cross-task issues**, invisible to any single task's own reviewer: (a) `AccountSettings.tsx`'s password fields are shadcn `Input`s with built-in `aria-invalid:` styling, so Task 6's shared-error wiring — adjudicated as a semantics-only tradeoff on `page.tsx`/`signup/page.tsx` (hand-rolled inputs, no such styling) — actually painted all three password fields with a visible invalid ring on any single field's error; fixed by splitting `Field`'s prop into an always-on `errorId` (for `aria-describedby`) and a per-error-condition `invalid` boolean. (b) Task 2's pre-select fix didn't fully close the loop: `RoleChangeDialog`'s `finally` block still unconditionally cleared `pendingRole`, which is harmless on success (dialog unmounts) but recreated the exact "opens blank" bug on a *failed* confirm, since `PersonDirectory` deliberately keeps the dialog open on failure so the user can retry — fixed by removing the redundant reset. Two Minor fixes were folded in at the same time: `AccessMatrix`'s error-state heading demoted `h2`→`h3` to stay correctly nested, and the upload-label focus ring got `rounded-md` so its shape matches every other focus ring in the app.

**Verification**: all 6 tasks + the final fix wave individually reviewed and approved; `npx tsc --noEmit`, `npm run lint`, and a full `npm run build` (20 routes) all clean on the final combined state. Merged into `branch-reconciliation`; not merged into `main`.

## Production sign-in diagnosis (2026-08-03)

A sign-in failure surfaced while live-verifying this branch. Diagnosed with real evidence rather than guessing:

- **Symptom:** login showed "That email and password don't match an account," with zero console errors and zero network requests ever reaching Supabase.
- **Root cause:** the test worktree's first production build (`next build`) ran before `.env.local` existed in that worktree, baking in `undefined` for `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `getSupabaseClient()` throws a clear error for this, but `page.tsx`'s `onSubmit` unconditionally overwrote *any* sign-in error with the generic "don't match" message — masking a config error as a bad password.
- **Ruled out:** Supabase's Site URL/Redirect URL allowlist — confirmed via direct `curl` against the `/auth/v1/token` endpoint that plain password-grant auth was completely healthy; that config only governs OAuth/magic-link redirects, never password sign-in.
- **Confirmed unaffected:** the real deployed site (`https://portal.arteagreenventures.com`) signed in cleanly with the same demo account — this was entirely a local test-rig artifact, never a production or Supabase-config defect.

## Branch `fix-signin-error-masking` — two fixes, merged in, live-verified

The generic-error-message masking found during the diagnosis above turned out to be a small recurring bug class. Fixed on its own isolated branch off `main` @ `eeaa8a9`, then merged into `branch-reconciliation`:

1. **Sign-in + password-change reauth (`73a7d21`).** `signIn()` (`src/lib/session.ts`) and `AccountSettings.tsx`'s password-change reauth both flattened every `signInWithPassword` failure — including the missing-env-var case above, network failures, rate limiting — into one generic "wrong password" message. Added `isInvalidCredentialsError()`, which checks GoTrue's own `invalid_credentials` error code: genuine wrong-password cases still get the existing safe, generic message (deliberate — not revealing whether an email exists is correct security practice, left unchanged); everything else now gets a distinct, honest message and is logged to the console via `console.error`.
2. **MFA verification (`85a336a`).** `AccountSettings.tsx`'s TOTP `challengeAndVerify()` had the identical pattern — any failure (expired challenge, IP mismatch, rate limiting) showed "That code didn't match," not just a genuine wrong code. Added `isMfaVerificationFailedError()` (GoTrue's `mfa_verification_failed` code) the same way.

**Verified live, not just by type-checking:**
- Regression: a real wrong password against a real demo account still shows the exact original message, no console noise.
- The actual fix: removed `.env.local`, rebuilt, reproduced the original bug, confirmed the UI now shows a distinct message and the console shows the real "Missing NEXT_PUBLIC_SUPABASE_URL..." error with a full stack trace. Restored `.env.local`, reconfirmed normal sign-in.
- MFA: signed up a throwaway test account (seed/demo accounts are deliberately excluded from MFA), enrolled a real TOTP factor, computed real codes locally. A wrong code still shows the original message with no console noise; the correct code completes enrollment normally. Deleted the test account afterward via the service role key — nothing left behind in Supabase.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean after both commits.

**Merging into `branch-reconciliation`:** two files were touched by both this branch and `harden-fixes` — `page.tsx` merged cleanly with both changes composing correctly (the `aria-describedby` wiring points at the single error paragraph regardless of which of the two possible messages is shown). `AccountSettings.tsx` had a real conflict in `PasswordSection`'s reauth handling (harden-fixes' per-field `invalidFields` tracking vs. this branch's `isInvalidCredentialsError()` distinction) — reconciled by keeping both: the `current` field is only marked invalid on a genuine wrong-password, not on an unrelated config/network failure. Re-verified `tsc`/`lint`/`build` clean on the merged result.

Not fixed (out of scope, flagged only): `AccountSettings.tsx`'s MFA *enrollment/removal* error handling and other catch blocks already forward their real error message rather than flattening it — no recurrence found there. `signup/page.tsx` and its API route were checked too — no recurrence.

## Known issues carried forward (still open, not part of this pass)

- The orphaned duplicate `auth.users` account (no `agv_profiles` row) flagged in an earlier phase is still unresolved.
- Google OAuth remains separately pending.
- `Tabs`'s `orientation` prop isn't forwarded to `TabsPrimitive.Root` (upstream registry quirk) — irrelevant so far, only horizontal orientation is used.
- The Roles/Directory person-select dropdown positioning bug reported in an earlier phase never reproduced in this session's tooling — still open, blocked on a real screenshot or more precise repro steps.

## Branches awaiting review

- `review-fixes` (off `main` @ `eeaa8a9`, 10 commits) — fixes from an earlier senior front-end review (WCAG contrast, `revokeAccess` guard, shared async/error-state components, admin self-demotion security fix, an integration test). Merged into `branch-reconciliation`; the standalone branch still exists unmerged into `main`.
- `harden-fixes` (off `main` @ `eeaa8a9`, 8 commits) — the 6 `/impeccable harden` fixes above. Merged into `branch-reconciliation`; the standalone branch still exists unmerged into `main`.
- `fix-signin-error-masking` (off `main` @ `eeaa8a9`, 3 commits) — the sign-in/MFA error-masking fixes above. Merged into `branch-reconciliation`; the standalone branch still exists unmerged into `main`.
- `branch-reconciliation` (this branch, off `main` @ `eeaa8a9`) — now the single integration branch carrying all three of the above, reconciled and live-verified. Not merged into `main` — still awaiting the user's own review.
