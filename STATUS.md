# AGV Portal — Status
Updated: 2026-07-23 14:20
Phase: 10b-3a — Role model change (user→staff, add client)
State: **Complete and verified.** Next up: 10b-3b (real writes), 10b-3c (access UI for three roles), 10b-3d (Storage) — independent of each other, all depend on this slice.

## Scope note: 10b-3 was split
The original 10b-3 spec bundled real writes, the three-role access UI, and Storage
together with the role model change. That's a lot to execute and verify carefully in
one pass, so — same standing invitation as the original 10b split and the 10c
navigation call — I split it: **10b-3a** (this session, role model only, foundational)
→ 10b-3b (writes) → 10b-3c (access UI) → 10b-3d (Storage). Plan:
`docs/superpowers/plans/2026-07-23-agv-10b-3a-role-model.md`.

## Done this session
- **Renamed `agv_profiles.role` value `user` → `staff`** everywhere: migration, RLS
  policies, the `Role` TypeScript type, `DEV_ACCOUNTS`, the mock store, `AccessMatrix`.
  "user" always meant AGV staff, never a client — this resolves that ambiguity.
- **Added a genuine third role: `client`.** Read-only always, even on applications
  it's granted to — no RLS policy anywhere ever grants a client role write access,
  regardless of grants.
- **⚠️ Behavior change, not a bug fix: `staff` now has real write rights** (status
  change, add-note) on applications they hold a live grant for, via a new
  grant-scoped RLS UPDATE/INSERT policy. This is a deliberate reversal of 10b-2's
  admin-only-edit simplification. **The UI doesn't call this yet** — that's 10b-3b;
  this slice only makes the capability exist and proves it works at the API/RLS level.
- **Added `visible_to_client boolean default false`** to `agv_activity_entries`.
  Existing/system entries stay hidden from client readers unless explicitly marked
  visible. Enforced entirely via RLS — zero application code needed.
- **Widened `AppShell`'s `expect` prop** from `Role` to `Role | Role[]`, and added a
  `PORTAL_ROLES` export (`["staff", "client"]`), so a `client`-role account can reach
  `/portal` without any new routes or components — it reuses the exact,
  already-verified 10b-2 `UserPortalView`/`UserApplicationView` components unmodified.
  No visual work in this slice, per the spec's own constraint.
- **New seed data**: `client1@agv-demo.com` (N. Reyes), granted `AGV-2026-0142` — the
  same application `user1`/staff already holds, so staff-vs-client visibility is
  directly comparable on identical data. One activity entry on that application marked
  `visible_to_client: true`.
- **Caught and fixed a real migration bug** before it could cause any lasting damage:
  the role-rename `UPDATE` originally ran *before* the old `admin`/`user`-only CHECK
  constraint was replaced, so it violated the very constraint it was meant to obsolete
  (`ERROR 23514`). The user caught this on the first apply attempt. Fixed by dropping
  the old constraint first, then renaming, then adding the final constraint. See
  "Known issues" below for the process lesson.

## Process note: switched off subagent-driven execution mid-session
10b-2 used full subagent-driven development (implementer + reviewer per task). For
this slice, after Task 1 was already dispatched as a subagent, you asked whether that
overhead was actually worth it for work this small and already fully specified — it
wasn't. Switched to direct execution for Tasks 2 and 3: I wrote the files myself,
verified with `npm run lint` / `npm run build` (a full project typecheck, which is the
real proof of consistency for a rename touching this many files), and did the
security-critical RLS review personally instead of dispatching a separate reviewer.
**Worth naming plainly: my own review of Task 1's migration checked the security
boundaries carefully and missed the statement-ordering bug entirely** — you caught it
by actually trying to apply it, which is the only thing that really proves a migration
is correct. Security review and ordering review are different checks; doing one well
doesn't cover the other.

## Files added/changed
- `supabase/migrations/20260723090000_role_staff_client.sql` — **new**; role rename +
  `client` role + `visible_to_client` + all new/updated RLS.
- `supabase/seed-users.mjs` — `user1`/`user2` role → `staff`; new `client1` account.
- `supabase/seed-domain.mjs` — `client1` grant on `AGV-2026-0142`; `visible_to_client`
  support in the activity-row mapping; one entry marked visible.
- `src/lib/session.ts` — `Role` type widened; new `PORTAL_ROLES` export; `DEV_ACCOUNTS`
  renamed/extended; `loadAccount()`'s fallback default `"user"` → `"staff"`.
- `src/components/AppShell.tsx` — `expect?: Role` → `expect?: Role | Role[]`.
- `src/app/portal/page.tsx`, `src/app/portal/applications/[id]/page.tsx` —
  `expect="user"` → `expect={PORTAL_ROLES}`.
- `src/lib/applications.ts`, `src/components/admin/AccessMatrix.tsx` — mock-store role
  literal rename only, for type-correctness against the widened `Role` type; both
  still fully mock-backed, unchanged visually, superseded in 10b-3c.

## Decisions made
- **`visible_to_client` enforced entirely via RLS**, not application code — the
  existing 10b-2 query layer and components needed zero changes; they just render
  whatever Postgres returns. Confirmed working end-to-end in verification below.
- **`AppShell`'s `expect` widened to `Role | Role[]`** rather than building any new
  client-specific routes — reuses 10b-2's read-only components as-is, satisfying "no
  visual work in this slice" with the least possible new code.
- **No column-level write restriction** on the new staff UPDATE policy (row-level
  grant-scoped only) — the application layer (10b-3b) is what will actually constrain
  which fields get sent. Documented scope cut, not an oversight.
- **`/admin/access` (`AccessMatrix.tsx`) still untouched beyond the type-correctness
  rename** — still mock-backed, still checkbox-toggle, doesn't yet know about the
  `client` role. Fully in scope for 10b-3c, not before.
- **No demo login card added for `client1`** (the login page's `QUICK_ACCESS` list) —
  that's hand-written label/hint copy, which is visual/branding work out of scope
  here. `client1` signs in via the existing manual email/password form. It *is* in
  `DEV_ACCOUNTS`, so the dev QuickSwitch and MFA-exclusion both cover it already.

## Known issues / TODO
- **The `staff` write capability exists in the database but nothing in the UI calls
  it yet.** `AdminApplicationView.tsx`'s edit controls are still admin-only and still
  the local-only shim from 10b-2 — 10b-3b replaces that shim with real writes and
  extends editing to `staff` via `/portal`.
- Process lesson (see above): for any future migration, statement-ordering
  verification needs its own explicit pass, separate from a security/RLS-boundary
  review — the two don't substitute for each other.
- Carry-overs: `StatusChip` `TIER_DOT` dead export; Turbopack AVIF logo warning.

## Blocked on / needs a decision
- Nothing blocking. For 10b-3d (Storage, later): you'll create a Supabase Storage
  bucket via dashboard — exact name + policies specified when we get there.
- Carried forward, still open, non-blocking: Supabase region (Singapore, pending LGU
  IT's data-residency call), dev seed password.

## Verification — proven empirically, same standard as 10b-1/10b-2
All via direct REST calls with real per-role JWTs (`/auth/v1/token?grant_type=password`),
against the live Supabase project, after the corrected migration was applied and both
seed scripts re-run:

- **`user1@agv-demo.com` (staff, granted `AGV-2026-0142`)** — `PATCH status_note` →
  `200`, write succeeded, reverted cleanly back to `null`.
- **`client1@agv-demo.com` (client, also granted `AGV-2026-0142`)** — identical `PATCH`
  attempt → `200` with `[]` (0 rows affected); follow-up `GET` confirmed `status_note`
  unchanged. **Rejected.**
- **`user2@agv-demo.com` (staff, NOT granted `AGV-2026-0142`)** — same `PATCH` attempt
  → `200` with `[]` (0 rows affected), confirmed unchanged. **Rejected** — proves the
  write policy is grant-scoped, not role-wide.
- **Activity visibility**: `user1` (staff) reads all 5 seeded entries for
  `AGV-2026-0142`. `client1` (client) reads exactly 1 — the one seeded
  `visible_to_client: true` ("We received this application through the portal.").
- **`client1` add-note attempt** — `POST` to `agv_activity_entries` → genuine `403`,
  `"new row violates row-level security policy for table agv_activity_entries"`. Hard
  rejection, not a silent no-op.
- **UI sanity check**: `client1` signed in, `/portal` loaded with no redirect loop,
  showed exactly `AGV-2026-0142`. Detail view rendered read-only (no status dropdown,
  no add-note form), all 4 documents visible (correctly unfiltered — only activity is
  role-filtered), activity section showed exactly the 1 visible entry. Zero new
  application code required for any of this.

## Next step
**10b-3b** (writes): replace `AdminApplicationView`'s local-only edit shim with real
Supabase writes; extend editing to `staff` via `/portal` now that they have real
rights. **10b-3c** (access UI): `/admin/access` becomes explicit grant/revoke against
`agv_application_access`'s lifecycle shape, handling all three roles. **10b-3d**
(Storage): real bucket + upload/list/download, policies mirroring this session's RLS.
3b/3c/3d are independent of each other; only this slice (3a) blocked all of them.
