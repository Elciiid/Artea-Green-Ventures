# AGV Portal — Status
Updated: 2026-07-22 21:40
Phase: 10b-2 — Rewire reads to real data
State: **Complete and verified.** Final whole-branch review: ready to merge. Next up: 10b-3 (writes + grant/revoke UI + Storage).

## Done this session
Rewired every application-reading surface except `/admin/access` off the mock Zustand
store onto real Supabase queries, filtered by RLS (proven in 10b-1) instead of
client-side visibility logic — with proper async loading/error states, and the admin's
edit UI kept interactive via local-only React state (10b-2 is read-only against
Supabase by design; real writes are 10b-3).

Executed via subagent-driven development: 7 implementation tasks, each with an
independent implementer + task-scoped code reviewer, plus a fresh browser-based
pixel-parity and RLS check performed directly by me against the live app for every
task with rendered UI output — not inherited from a prior task's check. Full ledger:
`.superpowers/sdd/progress.md`. Plan: `docs/superpowers/plans/2026-07-22-agv-10b-2-rewire-reads.md`.

**A process note worth flagging:** several target files already carried substantial
*uncommitted* work from earlier sessions (the Phase 16 ruled-detail redesign, sitting
in the working tree since before this execution began). Committing "just the task's
file" would have silently swept that unrelated work into the task's commit. I caught
this after Task 5's first pass did exactly that (and the task reviewer correctly
flagged it), then pre-emptively isolated the remaining affected files into their own
"carry forward pre-existing work" commits before dispatching Tasks 6-8, so every task
commit stays properly scoped to only what that task actually did.

## Commit policy for this session (read before assuming anything is "saved")
Per your explicit approval, I committed locally as each task completed — this is what
let the subagent review-diffing mechanism work as designed, and gives you a real,
inspectable history of what changed and why. **Nothing was pushed anywhere.** It's
still 100% yours to squash, rewrite, or reset before it ever leaves this machine. New
commits since the last status update: `bd93bfa` through `32fb519` (17 commits — 7 task
commits, 4 pre-existing-work isolation commits, the seed ordering fix, and a small
post-review polish commit). Run `git log bd93bfa~1..HEAD --oneline` to see the full list.

## RLS verification — through the running UI this time (10b-1 proved it via direct API calls)
- **admin@agv-demo.com** — `/admin` shows all 3 applications, pixel-identical to Phase
  16. `/admin/applications/AGV-2026-0142` — every field matches `mock-data.ts` exactly,
  **including document order** (EIS Addendum → Noise & Vibration → Groundwater → Site
  Access — confirms the seed's `created_at` staggering fix took effect). Changed status
  via the real dropdown: chip/stepper/activity updated live; reloaded — reverted to
  "Under Review", confirming the edit is session-local only, as designed.
- **user1@agv-demo.com** — `/portal` shows exactly 2 applications (`AGV-2026-0142`,
  `AGV-2026-0118`). Direct navigation to `/portal/applications/AGV-2026-0161` (exists,
  granted to user2 not user1) and to `/portal/applications/AGV-2026-9999` (doesn't
  exist) both render the identical "You don't have access to this application" state —
  no crash, no blank screen, no console errors — confirming RLS collapses "not found"
  and "not granted" as designed.
- **user2@agv-demo.com** — `/portal` shows exactly 1 application (`AGV-2026-0161`).
  `/portal/applications/AGV-2026-0142` (granted to user1, not user2) — same correct
  blocked state.
- **Non-admin route boundary** — user1 hitting `/admin` or `/admin/applications/AGV-2026-0142`
  directly is redirected to `/portal` before `AdminDashboard`/`AdminApplicationView`
  ever render or query — the admin surfaces are unreachable by a non-admin, not merely
  filtered.
- **Phase 10a/10c regression check** — `/account` (password change, MFA) and
  `/admin/access` (still mock-backed, untouched by this slice) both render normally.
- **Known limitation:** the QuickSwitch same-route no-reload refetch path (the reason
  every rewired component's fetch is keyed on account identity, not just mount) was
  verified at the code level only — confirmed present and correct by every task
  reviewer and the final reviewer — not exercised via an actual QuickSwitch click,
  because the Browser pane wasn't compositing/visible this session (confirmed via
  repeated failed screenshot calls; DOM-read tools worked fine). All cross-account
  checks above used a direct auth-token cookie swap + forced reload instead, which
  proves per-account data correctness but doesn't exercise the no-reload path
  specifically. Low-risk residual gap: it rests on two already-established facts
  (React re-runs effects when a dependency changes; `useSession`'s account state
  updates via `onAuthStateChange`, unchanged since Phase 10a), not new logic this
  slice introduced.

## Files added/changed
- `src/lib/supabase/applications.ts` — **new**; `fetchApplications()` /
  `fetchApplicationByReference()`, the only place Supabase queries for application
  data live now.
- `src/components/RegisterStatus.tsx` — **new**; shared loading/error placeholder for
  the two register views.
- `src/components/admin/AdminDashboard.tsx`, `src/components/UserPortalView.tsx` —
  rewired to `fetchApplications()`.
- `src/components/ApplicationDetail.tsx` — `useApplications` calls replaced with
  `onStageChange`/`onAddNote` callback props; zero visual/DOM change.
- `src/components/admin/AdminApplicationView.tsx` — rewired to
  `fetchApplicationByReference()`; owns the local-only edit-state shim.
- `src/components/UserApplicationView.tsx` — rewired to `fetchApplicationByReference()`.
- `src/app/admin/applications/[id]/page.tsx`, `src/app/portal/applications/[id]/page.tsx`
  — dropped `generateStaticParams` (was sourced from stale mock data); both routes now
  render dynamically (confirmed via `npm run build`'s route table).
- `supabase/seed-domain.mjs` — documents now get staggered `created_at` values so
  `ORDER BY created_at` reproduces their original (non-chronological) display order.
  **You already re-ran this seed** — confirmed by the document-order check above.

## Decisions made
- **RLS does the filtering now, not client code.** `fetchApplications()` runs the
  identical query for every account; Postgres decides what comes back. The old
  `visibleApplicationsFor`/`isApplicationVisible` client-side checks are gone from
  every rewired file.
- **Admin edits stay session-local, not real writes, for this slice** — removing the
  status-change/add-note controls would have been a Phase 16 regression, but writing
  to Supabase is explicitly 10b-3's job. A refresh discards the edit; this is the
  honest interim behavior, not a bug.
- **`/admin/access` (`AccessMatrix.tsx`) and `AppShell.tsx`'s "Reset demo data" button
  are deliberately untouched** — they still operate correctly on the mock store, which
  remains the right backing for that still-mock-backed page until 10b-3 rewires it too.
- **`.ilike()` escaping added** (final-review finding) so a stray `%`/`_` in a URL
  can't match multiple rows and surface a generic error instead of the correct
  not-found/blocked state.

## Known issues / TODO
- Two Minor final-review findings left as-is (both explicitly framed as non-blocking):
  the stage-change shim's missing same-stage no-op guard (unreachable via a native
  `<select onChange>`), and light markup duplication between the two detail views'
  loading/error states (intentional per the plan, flagged as a 10b-3 consolidation
  candidate).
- QuickSwitch same-route refetch: code-verified only, not click-tested this session —
  see the Known limitation note above. Worth a real click-through next time the
  Browser pane is compositing normally.
- Carry-overs from 10b-1: `StatusChip` `TIER_DOT` dead export; Turbopack AVIF logo
  warning.

## Blocked on / needs a decision
- Nothing blocking. For 10b-3: you'll create a Supabase **Storage bucket** (dashboard)
  — I'll specify name + policies exactly when we get there.
- Carried forward, still open, non-blocking: Supabase region (Singapore, pending LGU
  IT's data-residency call), dev seed password.

## Next step
**10b-3**: writes (status change, add-note) against real Supabase tables, replacing
this slice's local-only shim; the `/admin/access` UI changes from a checkbox-toggle to
explicit grant/revoke actions matching `agv_application_access`'s lifecycle-record
shape; real Supabase Storage bucket + upload/list/download.
