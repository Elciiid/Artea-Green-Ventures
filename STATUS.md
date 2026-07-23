# AGV Portal — Status
Updated: 2026-07-23 16:05
Phase: 10b-3b/3c/3d — Real writes, access UI, Storage
State: **Complete and verified.** All of 10b-3 is done. Next up: Phase 17 (visual/branding pass for the client-facing surfaces now that the client role actually exists to design against) — this session did no visual work by design.

## Scope note: executed 3b/3c/3d together
After 10b-3a, you asked whether the remaining three slices could go in one pass —
reasonable, since they don't depend on each other and 3a (the risky, foundational
piece) was already done and verified. One real design call got made first: whether to
unify `AdminApplicationView`/`UserApplicationView` into one shared editable component
now that both admin and staff need edit rights. **Decision: keep them separate** — more
admin-only features are planned, and coupling the two views now would work against
that. Shared logic lives at the data layer (`src/lib/supabase/*.ts`) instead; both
components call the same functions independently.

## Done this session

### 10b-3b — Real writes
Replaced `AdminApplicationView`'s local-only edit shim with real Supabase writes.
`changeApplicationStage()` updates the row and logs the matching activity entry
(sequential, not atomic — see Known issues). `addActivityNote()` inserts a comment
entry. Both are keyed by reference (like the read functions), resolving to the real
row uuid internally. `ApplicationDetail`'s `onStageChange`/`onAddNote` callbacks are now
`Promise<void>` — a rejected write shows an error toast instead of a false-positive
success one. **`UserApplicationView` now also wires these in for `staff`** (never
`client`) — staff editing via `/portal` is a new capability this session, not present
before.

### 10b-3c — Access UI, three roles
`AccessMatrix.tsx` rewritten off the mock store onto `agv_application_access`'s real
lifecycle records. Same checkbox-grid visual shape as before (no visual/branding work,
per the phase constraint) — but each click is now a real grant or revoke, not an
instant local mutation. Revoking sets `revoked_at`; it does **not** delete the row, and
re-granting after a revoke creates a genuinely new row rather than reviving the old one
— both explicitly verified below, not just implemented. Each profile row now shows a
role badge (staff/client) so admin can see who they're granting to.

### 10b-3d — Storage
Private `agv-documents` Supabase Storage bucket, created via SQL migration rather than
a manual dashboard step. Upload attaches a file to an *existing* pending document row
(no "add a new document type" UI this phase); download signs a short-lived URL.
Storage policies mirror the database RLS boundary exactly — admin unconditional,
staff via grant, client read-only via grant, never write.

## Two real bugs found during verification, both fixed
**Not a lower bar than 10b-1/10b-2's verification — these are exactly the kind of thing
that standard is for.**

1. **Missing `agv_documents` staff write policy.** The 10b-3a migration added staff
   write policies for `agv_applications` and `agv_activity_entries` but not
   `agv_documents` — uploading as staff returned a success toast (the Storage file
   upload genuinely succeeded) while the row silently stayed `pending`. Root cause:
   Postgres `UPDATE` doesn't error when its `USING` clause matches 0 rows — it just
   "succeeds" with an empty result, unlike `INSERT`, which throws a real RLS error.
   Fixed with a new migration, **and** hardened `changeApplicationStage()` and
   `uploadDocument()` to check the updated row actually came back rather than trusting
   "no error" as proof of a write.
2. **Missing `storage.objects` staff UPDATE policy.** `uploadDocument()` uses
   `{ upsert: true }` so retrying a failed upload doesn't error on a duplicate key —
   but overwriting an existing object is an UPDATE on `storage.objects`, and the first
   storage migration only granted staff INSERT. Surfaced immediately on the retry
   after fixing bug #1 (same file path, now existing from the first attempt). Fixed
   with a second small migration.

Both were caught because you applied each migration yourself and reported back what
actually happened — same pattern as 10b-3a's ordering bug. That loop is doing real
work; it's not just process overhead.

## Files added/changed
- `supabase/migrations/20260723140000_storage_documents.sql` — bucket + storage RLS
  (admin all, read via grant, staff insert via grant).
- `supabase/migrations/20260723150000_documents_staff_write.sql` — the missing
  `agv_documents` staff UPDATE policy.
- `supabase/migrations/20260723151500_storage_staff_update.sql` — the missing
  `storage.objects` staff UPDATE policy (for upsert re-uploads).
- `src/lib/supabase/applications.ts` — `changeApplicationStage()`, `addActivityNote()`,
  `findApplicationId()` (now exported, reused by the new documents module); documents
  query extended with `id`/`storage_path`.
- `src/lib/supabase/documents.ts` — **new**; `uploadDocument()`, `getDocumentDownloadUrl()`.
- `src/lib/supabase/access.ts` — **new**; `fetchGrantableProfiles()`,
  `fetchApplicationsForAccess()`, `fetchLiveGrants()`, `grantAccess()`, `revokeAccess()`.
- `src/lib/mock-data.ts` — `DocumentItem` gains optional `id`/`storagePath`.
- `src/components/ApplicationDetail.tsx` — async callback signatures + error toasts;
  real download on received documents; real upload control on pending ones when
  `canEdit`.
- `src/components/admin/AdminApplicationView.tsx`,
  `src/components/UserApplicationView.tsx` — real writes wired through; upload handler
  added; kept as separate components (see Scope note).
- `src/components/admin/AccessMatrix.tsx` — full rewrite onto real grant/revoke.

## Decisions made
- **`AdminApplicationView`/`UserApplicationView` stay separate** (see Scope note) —
  saved as a standing project preference so this doesn't get re-proposed later.
- **Stage change is two sequential writes (app update + activity insert), not one
  transaction.** Accepted simplification, documented in code — a failure between the
  two would leave the stage changed without a matching timeline entry. No RPC/
  transaction wrapper yet.
- **Write functions now verify the row actually came back after an UPDATE**, not just
  that no error was thrown — direct response to the two bugs above, applied to both
  `changeApplicationStage` and `uploadDocument`. `addActivityNote`/`grantAccess` don't
  need this (INSERT throws on RLS denial, doesn't silently no-op).
- **Access UI keeps the checkbox-toggle affordance**, now backed by real grant/revoke
  instead of an instant mock mutation — read as satisfying "explicit grant/revoke
  actions" without inventing a new interaction pattern (which would be more
  visual-design work than this phase allows).
- **This phase's upload only fulfills existing pending document rows** — no new
  document type creation, no delete/replace. The three seeded applications'
  already-"received" documents predate Storage and have no real file behind them.

## Known issues / TODO
- Stage-change's two-write non-atomicity (see Decisions).
- The RLS gaps found this session (agv_documents, storage.objects UPDATE) suggest the
  10b-3a migration's own self-review wasn't as thorough on "does every table that needs
  a new capability actually have a policy for it" as it was on "is the security boundary
  correct for the policies that do exist." Worth an explicit checklist pass on any
  future migration: enumerate every table x role x operation combination the new
  capability needs, don't rely on remembering them all.
- Carry-overs: `StatusChip` `TIER_DOT` dead export; Turbopack AVIF logo warning.

## Blocked on / needs a decision
- Nothing blocking. Phase 17 (visual/branding for client-facing surfaces) is next,
  whenever you want it — no urgency from this session's side.
- Carried forward, still open, non-blocking: Supabase region (Singapore, pending LGU
  IT's data-residency call), dev seed password.

## Verification — proven empirically
All via the running dev server with real per-role sessions (cookie-based session
switching, since native file-picker dialogs and some click paths aren't automatable
from this tool — file selection was simulated via a synthetic `File`/`DataTransfer`
dispatched to the real input's change handler, which exercises the exact same
`uploadDocument()` code path a real user's file picker would).

- **Staff (user1) real write persists**: changed `AGV-2026-0142`'s stage to "Site
  Visit" via the real UI dropdown at `/portal/applications/AGV-2026-0142`, reloaded —
  still "Site Visit" (unlike 10b-3a's shim, which reverted). A matching "Status moved
  to Site Visit." activity entry was created. Reverted back to "Under Review" (also
  persisted, also logged) to leave the seed data clean.
- **Add-note real write**: submitted a note via the real form; it appeared in the
  activity list attributed to S. Whitfield, dated today.
- **Upload round trip**: uploaded a test file to the pending "Groundwater Baseline
  Data.xlsx" document as staff. Document flipped to "received" with the correct size
  and today's date. Downloaded it back via a signed URL — content matched exactly what
  was uploaded. **This document is left in its "received" state** — a genuine
  demonstration of the feature, not test data to clean up.
- **Client (client1) upload rejected**: direct attempt to upload a new file to a
  granted application's folder → `403`, `"new row violates row-level security
  policy"`. Hard rejection.
- **Client (client1) download succeeds**: signing a URL for the same document staff
  just uploaded → `200`, succeeds — proving client's read-only boundary is genuinely
  read-*only*, not no-access.
- **Access UI, real data**: `/admin/access` shows N. Reyes (client, sees 1 of 3),
  R. Santiago (staff, sees 1 of 3), S. Whitfield (staff, sees 2 of 3) — matching the
  actual seeded/tested grant state exactly, with correct role badges.
- **Grant via UI persists**: granted N. Reyes access to `AGV-2026-0161` by clicking;
  count updated live, reloaded — still there.
- **Revoke via UI is a lifecycle update, not a delete**: revoked that same grant;
  direct query confirmed the row still exists with `revoked_at` set to a real
  timestamp, not removed.
- **Re-grant after revoke creates a new row**: granted the same (profile, application)
  pair again; direct query confirmed two distinct rows — the original (revoked) and a
  genuinely new one (`revoked_at: null`) — not a resurrected old row. Reverted this
  final test grant to restore the original clean seed state (N. Reyes back to 1 of 3).
- **Admin write path**: not separately click-tested this session — `changeApplicationStage`
  and `uploadDocument` are the same functions already proven correct for the more
  restricted staff-with-grant case, and admin's underlying policy
  (`"applications — admin all"`, unconditional) predates this session and was proven in
  10b-1. Judged redundant to re-click through given time; flagging the gap honestly
  rather than silently claiming it was tested.

## Next step
**Phase 17**: visual/branding design pass for client-facing surfaces, now that the
`client` role actually exists to design against. This session's work is functional
but deliberately unstyled beyond reusing existing patterns (role badges, spinners,
toasts already established elsewhere in the app).
