# AGV Portal — Status
Updated: 2026-08-03
Phase: Branch reconciliation — merging `review-fixes` + `harden-fixes` on integration branch `branch-reconciliation`, live-verifying, prepping docs for review
State: Kokonut UI Adoption (Slices 0–5) and everything before it is done and was reported in full in an earlier chat — not repeated here. Nothing pushed or merged to `main` yet. Live at `https://portal.arteagreenventures.com`. THIS SECTION WILL BE REWRITTEN IN FULL ONCE THE RECONCILIATION/VERIFICATION PASS COMPLETES.

## Impeccable setup

Installed the `impeccable` design skill globally (`~/.claude/skills/impeccable`) and ran its setup on this project: wrote `PRODUCT.md` (product truth — users, roles, per-application access-grant model) and `DESIGN.md` + `.impeccable/design.json` (visual system — Creative North Star "The Canopy Registry": warm forest palette, glass-first depth, one accent color, tactile press/focus feedback; documents the full color/typography/component vocabulary already implemented). **These three sit untracked on `main` — not yet committed, awaiting the user's own review first.** `FRONTEND_REVIEW.md` (the source document behind this whole critique/audit/harden cycle) was also found still untracked on `main` with no commit history on any branch — flagged, not caused by this pass.

## Critique + audit (whole app)

`/impeccable critique` (dual-agent: an isolated LLM design review plus a detector/browser-evidence pass) and `/impeccable audit` (single-context technical scan) both ran against the whole app. Combined score: critique 23/40 ("Acceptable"), audit 14/20 ("Good"). Full critique report persisted at `.impeccable/critique/2026-08-01T04-41-43Z__the-whole-app.md`.

Findings were consolidated into one backlog and mapped to the specific `/impeccable` command that addresses each — no speculative sweeps with commands that had no evidenced finding behind them (`bolder`/`animate`/`overdrive`/`colorize`/`typeset`/`distill`/`onboard`/`delight` were all explicitly skipped: nothing in either pass called for them, and running them would have worked against `DESIGN.md`'s own documented restraint).

Deferred, not done yet: `/impeccable polish` (login/signup consistency at the design level, `.glass`-over-flat-background), `/impeccable clarify` (Access matrix per-application visibility), `/impeccable adapt` (touch-target sizing), `/impeccable optimize` (`ApplicationDetail`'s missing pending-guard pattern) — scoped out per the user's explicit choice to do `harden` first, in isolation.

## Branch `harden-fixes` — complete, awaiting review

Isolated worktree at `.worktrees/harden-fixes`, off `main` @ `eeaa8a9`. Executed the `/impeccable harden` bucket — 7 findings across 6 subagent-driven tasks, each independently task-reviewed, plus a final whole-branch review:

1. Gated the hardcoded "Demo record, not an official document" colophon on `ApplicationDetail.tsx` behind `showDevTools()` (matching `AppShell.tsx`'s existing pattern) — this was shipping unconditionally to real clients in production before this fix.
2. Fixed `RoleChangeDialog`'s blank pre-select bug (Radix's `onOpenChange` never fires for an externally-driven `open` prop, so the effect that should seed the current role never ran) and added an inline warning when the pending selection is `admin`.
3. Promoted the People area's per-tab label (`PeopleSectionHeading`) from a `<span>` to a real `<h2>`, and `PersonDirectory`'s group titles from `<h2>` to `<h3>`, giving Directory/Access/Activity their own heading identity under the shared page `<h1>` — screen-reader heading navigation previously couldn't distinguish the three tabs.
4. Added a visible `focus-within` ring (reusing the app's standard signal-color ring tokens) to the document-upload control on Application Detail, previously invisible to keyboard-only users.
5. Migrated Login/Signup off 11 hardcoded `bg-white/NN` values onto the `pine` token, and swapped their 4 `active:scale-[0.99]` button presses for the system-standard `active:translate-y-px` — the two most-seen pages in the app had never gone through the earlier Kokonut/shadcn token migration.
6. Wired `aria-invalid`/`aria-describedby` on Login/Signup/Account-Settings/MFA form inputs, so screen-reader users tabbing back to a failed field get an in-context signal, not just a one-time announcement.

**Final whole-branch review caught two real cross-task issues**, invisible to any single task's own reviewer: (a) `AccountSettings.tsx`'s password fields are shadcn `Input`s with built-in `aria-invalid:` styling, so Task 6's shared-error wiring — adjudicated as a semantics-only tradeoff on `page.tsx`/`signup/page.tsx` (hand-rolled inputs, no such styling) — actually painted all three password fields with a visible invalid ring on any single field's error; fixed by splitting `Field`'s prop into an always-on `errorId` (for `aria-describedby`) and a per-error-condition `invalid` boolean. (b) Task 2's pre-select fix didn't fully close the loop: `RoleChangeDialog`'s `finally` block still unconditionally cleared `pendingRole`, which is harmless on success (dialog unmounts) but recreated the exact "opens blank" bug on a *failed* confirm, since `PersonDirectory` deliberately keeps the dialog open on failure so the user can retry — fixed by removing the redundant reset. Two Minor fixes were folded in at the same time: `AccessMatrix`'s error-state heading demoted `h2`→`h3` to stay correctly nested, and the upload-label focus ring got `rounded-md` so its shape matches every other focus ring in the app.

**Known overlap, not yet resolved**: `RoleChangeDialog.tsx` is independently touched by both this branch and the still-unmerged `review-fixes` branch, each fixing the same underlying pre-select bug plus (now) the same `finally`-reset issue. Whoever merges the two branches needs to reconcile this one file rather than take both changes blindly.

**Verification**: all 6 tasks + the final fix wave individually reviewed and approved; `npx tsc --noEmit`, `npm run lint`, and a full `npm run build` (20 routes) all clean on the final combined state (commit `741b83c`... `93631b0` after a STATUS.md correction). Nothing pushed or merged — sitting on `harden-fixes`, awaiting the user's own review.

## Known issues carried forward (still open, not part of this pass)

- The orphaned duplicate `auth.users` account (no `agv_profiles` row) flagged in an earlier phase is still unresolved.
- Google OAuth remains separately pending.
- `Tabs`'s `orientation` prop isn't forwarded to `TabsPrimitive.Root` (upstream registry quirk) — irrelevant so far, only horizontal orientation is used.
- The Roles/Directory person-select dropdown positioning bug reported in an earlier phase never reproduced in this session's tooling — still open, blocked on a real screenshot or more precise repro steps.

## Two unmerged branches, both awaiting review

- `review-fixes` (off `main` @ `eeaa8a9`, 10 commits) — fixes from an earlier senior front-end review (WCAG contrast, `revokeAccess` guard, shared async/error-state components, admin self-demotion security fix, an integration test).
- `harden-fixes` (off `main` @ `eeaa8a9`, 8 commits, this pass) — the 6 `/impeccable harden` fixes above.

Both branch from the same commit and both independently touch `RoleChangeDialog.tsx`. Whichever merges first, the other will need a manual reconciliation pass on that one file.
