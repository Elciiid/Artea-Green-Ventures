# AGV Portal — Status
Updated: 2026-08-06
Phase: Two new isolated branches off `main` @ `51fd286` — `companies-access-model` (new access-control layer: client companies, client managers) and `fix-signup-role-injection` (unrelated security fix found along the way). Both complete, reviewed, and live-verified; neither merged into `main` yet. The separate `branch-reconciliation` effort described below (`review-fixes`/`harden-fixes`/`fix-signin-error-masking`) is still unmerged too — none of these five branches have landed on `main` yet. A large visual redesign (Mistral-inspired, then a further "bold" pass) also happened on a separate branch lineage off `main`, also unmerged — see that branch's own STATUS.md, not repeated here.
State: Kokonut UI Adoption (Slices 0–5) and everything before it is done and was reported in full in an earlier chat — not repeated here. Nothing pushed or merged to `main` yet. Live at `https://portal.arteagreenventures.com`.

## Branch `companies-access-model` — complete, adversarially tested, awaiting review

New access-control tier: a company has a set of applications in scope and zero or more client profiles, any number of which may be flagged `is_company_manager` (a flag on the existing `client` role, not a new role) to grant/revoke `agv_application_access` for their own teammates within that scope. Isolated worktree off `main` @ `51fd286`. Subagent-driven execution, 3 tasks + a final whole-branch review, given the same rigor as the earlier admin self-demotion fix — real adversarial testing against the live Supabase project, not just UI-level checks.

**Schema** (8 migrations, all applied live): `agv_companies` (id, name, created_by), `agv_profiles` gains nullable `company_id` + `is_company_manager` (default false), `agv_company_applications` (company_id/application_id scope, lifecycle rows like `agv_application_access` — revoked, never deleted). The existing `agv_application_access` grant mechanism was extended with RLS policies, not replaced — `grantAccess`/`revokeAccess` in `access.ts` needed zero code changes.

**What adversarial testing against the live project actually found and fixed** — five real bugs, not zero:
1. An RLS-recursion bug: the manager policies' own subqueries were blocked by RLS on the tables they read, so grants failed for everyone until fixed with `SECURITY DEFINER` helper functions (same pattern as the existing `agv_is_admin()`/`agv_has_app_access()`).
2. A stale-policy false start — an em-dash encoding mismatch on paste meant a fix silently didn't apply; caught by re-querying `pg_policies` directly rather than trusting "no error" from the SQL editor.
3. A genuine Postgres semantics gap: `UPDATE`/`DELETE` require SELECT-visibility on top of the UPDATE policy itself, which nothing granted — a manager's revoke silently no-op'd with no error. Found via `EXPLAIN ANALYZE` against a live fixture, not guessed.
4. **The most serious**, caught by the task reviewer, not by the adversarial suite itself: the revoke policy checked *who* but not *which columns* — a manager could retarget an existing grant's `application_id` to bypass company scope entirely, or resurrect an old out-of-scope grant by clearing `revoked_at`. Closed with a column-tamper trigger (`agv_prevent_application_access_tamper`), the same pattern this codebase already used twice elsewhere (`agv_prevent_self_role_escalation`, `agv_prevent_staff_application_tamper`) for the identical bug class — an own-row/granted-row policy checking WHO but not WHICH COLUMNS.
5. Two hardening items from the final whole-branch review: an unguarded `id` column on the tamper trigger (audit-trail integrity, not access) and a defense-in-depth role filter (`agv_manager_company_id()`/`agv_profile_in_manager_company()` now both require `role = 'client'` on the relevant side, closing a hypothetical staff-assigned-to-a-company misconfiguration on both the actor and target side).

**Adversarial test results** (fresh throwaway data each time, real Postgres error codes, all cleaned up afterward — zero rows confirmed remaining): granting a different company's client fails (`42501`); granting an out-of-scope application fails (`42501`, both via direct INSERT and via the two UPDATE-based bypasses found later); acting as a manager while `is_company_manager = false` fails (`42501`); self-escalation via direct `agv_profiles` PATCH fails (`P0001`). All legitimate paths — grant, revoke, multiple simultaneous managers per company — genuinely succeed, re-verified via service-role re-query rather than trusted client responses.

**Admin page** (`/admin/companies`, `/admin/companies/[id]`): company list reusing `AccessMatrix`'s filter `Input` + `SimplePagination` (not new components); create-company dialog; per-company roster add/remove with a real confirm dialog on reassignment; unbounded manager-status toggling; application-scope checkboxes reusing `AccessMatrix`'s visual pattern; an unassigned-clients section (`company_id is null`) with a direct assign action. All writes to `agv_profiles` for another person's row go through a new service-role route (`/api/admin/set-company`), following the existing `set-role` pattern exactly — verified by the final reviewer with a direct grep, not assumed.

**Nav**: "Home" relabeled "Dashboard" (universal, label only); "Companies" added to the admin-only nav row (`Dashboard | Applications | People | Companies`). Every other role's nav is untouched.

**Final whole-branch review** (most capable model available) independently re-derived the final deployed RLS/trigger state from the 8 layered migrations and confirmed the tamper trigger now has *complete* column coverage on `agv_application_access` — the strongest available confirmation that no further vector exists, not just "no third vector was found by testing." Found and fixed two more small issues: admin-facing "Application scope" UI copy that implied unchecking an application immediately revokes existing access (it doesn't — it only affects the ceiling for *future* manager grants; copy corrected) and the actor-side mirror of item 5's role filter.

**Verification**: `npx tsc --noEmit`, `npm run lint`, `npm run build` (routes include `/admin/companies`, `/admin/companies/[id]`, `/api/admin/set-company`), `npm run test` all clean on the final combined state, independently re-run by the controller, not just trusted from task reports.

## Branch `fix-signup-role-injection` — complete, live-verified, awaiting review

A live, pre-existing, unrelated privilege-escalation hole surfaced as a side discovery during `companies-access-model`'s final review — flagged immediately rather than folded silently into that branch, and fixed on its own isolated branch off `main` @ `51fd286` per explicit direction.

**The hole**: `agv_handle_new_user()` (the `AFTER INSERT ON auth.users` trigger) read `role` from `raw_user_meta_data`, which is client-suppliable by design in Supabase Auth — reachable by anyone with the public anon key, completely bypassing this app's own `/api/auth/signup` route. Confirmed live: a raw `signUp()` call with `role: 'admin'` in metadata produced an `agv_profiles` row with `role: 'admin'` — full unconditional access, no approval, no review.

**Fix**: the trigger now always defaults new profiles to `client` (this app's least-privileged role, cross-checked against the actual RLS rather than assumed) and never reads `role` from metadata. Every legitimate role-assignment path (`/api/auth/signup`'s staff and client branches, `seed-users.mjs`) now does an explicit, privileged UPDATE afterward instead, via the service-role client — the same established pattern as `set-role/route.ts`. The OAuth callback (`src/app/auth/callback/route.ts`) turned out to already be safe; confirmed by direct reading, not trusted.

**A second independent review round found three more real issues, all fixed**: the new staff-branch UPDATE had no guard against an already-registered-but-unconfirmed email (GoTrue can return that user's real id rather than an obfuscated one, so the new write path could have silently reset an existing account's role — now guarded on `identities.length > 0`); the migration's version prefix (`20260805120000`) collided with one on the `companies-access-model` branch, which would have broken Supabase's migration tracking when both eventually merge — renamed to `20260805190000`, content byte-identical, confirmed via git's rename detection; both new UPDATEs silently discarded their errors — now checked and logged, matching `set-role`'s own pattern.

**Verified live**: pre-fix exploit reproduced for real, post-fix exploit blocked (worked around Supabase's very low default email-send rate limit — custom SMTP is off on this project — by substituting `auth.admin.createUser()` for `signUp()` where only the shared trigger's behavior was being tested, not `signUp()`'s own return shape specifically), client-domain signup verified end-to-end through the live dev server, staff-domain role assignment confirmed via the identical explicit-UPDATE code path, all test accounts cleaned up and re-confirmed zero remaining. `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

**Not yet done**: this branch and `companies-access-model` haven't been merged together or into `main` — the migration rename above exists specifically so that merge doesn't break migration tracking, but the merge itself hasn't happened.

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
- `companies-access-model` (off `main` @ `51fd286`, 8 commits + 8 migrations) — the companies/client-manager access-control layer above. Not merged anywhere yet.
- `fix-signup-role-injection` (off `main` @ `51fd286`, 2 commits) — the signup privilege-escalation fix above. Not merged anywhere yet. Has a migration specifically renamed to avoid a version collision with `companies-access-model` when the two eventually meet.
- Separately, a large visual redesign (Mistral-inspired hero/nav/motion rework, then a further "bold" amplification pass across Home/Applications/People) happened on its own branch lineage off `main` — also unmerged, own STATUS.md, not detailed here.
