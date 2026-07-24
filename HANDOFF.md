# AGV Portal — Handoff

Paste this whole file into a new chat to pick up where this session left off.

## What this project is

**AGV Portal** — a demo environmental-compliance application tracker for
"Artea Green Ventures," built to showcase to a client. Next.js 16 (App
Router) + TypeScript + Tailwind v4, backed by Supabase (Postgres, Auth, RLS,
Storage). Repo: `E:\Work\Code\AVG-Portal`. Pushed to
`github.com/Elciiid/AVG-Portal`.

Always read **`STATUS.md`** at the repo root first — it's the canonical,
continuously-updated status doc (template + full detail on the latest phase).
This handoff is a narrative companion to it, not a replacement.

## Where things stand

Phase **10b-3** (all of 3a/3b/3c/3d) is **complete, verified, and committed**
through commit `3f8e883`. Nothing pushed to remote yet — all work this
session was local commits only, per standing user approval of that policy.

The app has moved from a mock/local-only demo to a fully Supabase-backed
app: real reads (10b-2, done earlier), real writes, a real three-role
permission model, a real grant/revoke access UI, and real file Storage
(10b-3, done this session).

**Next planned step: Phase 17** — a visual/branding design pass for
client-facing surfaces, now that the `client` role actually exists to design
against. This session's work is functional but deliberately unstyled beyond
reusing existing patterns (role badges, spinners, toasts). **Not started —
wait for the user to explicitly ask for it before beginning.**

## The three roles

- **`admin`** — full unconditional access to everything.
- **`staff`** (renamed from `user` this session) — read/write on applications
  they've been granted access to (via `agv_application_access`).
- **`client`** (new this session) — read-only, always, even on applications
  they've been granted access to. Can view an activity entry only if it's
  marked `visible_to_client`.

Access to a specific application is a **grant**, not a role-wide permission —
rows in `agv_application_access` are lifecycle records: `granted_at` +
nullable `revoked_at`. Revoking sets `revoked_at`, never deletes the row.
Re-granting after a revoke inserts a **new** row rather than reviving the
old one (a partial unique index enforces at most one *live* grant per
`(application_id, profile_id)` pair).

## What got built this session (10b-3)

1. **Role model migration** (`agv_profiles.role`: `user`→`staff`, added
   `client`), new RLS helper functions (`agv_is_staff()`, `agv_is_client()`),
   `visible_to_client` column on activity entries.
2. **Real writes** — `changeApplicationStage()` and `addActivityNote()` in
   `src/lib/supabase/applications.ts` replaced the old local-only edit shim.
   Staff can now edit via `/portal` too (new capability this session).
3. **Real grant/revoke access UI** — `AccessMatrix.tsx` rewritten off
   `agv_application_access`'s real lifecycle-record shape, now showing/
   handling all three roles with role badges.
4. **Real Supabase Storage** — private `agv-documents` bucket, upload
   attaches a file to an existing pending document row, download signs a
   short-lived URL. Storage RLS mirrors the DB RLS boundary exactly.

Everything above was **proven empirically** with real per-role Supabase
sessions (not just implemented) — see STATUS.md's "Verification" section for
the full list of what was tested and how.

### Two real RLS bugs found and fixed during verification

Both are the kind of gap that only shows up when you actually try the
feature end-to-end as the restricted role, not from reading the migration:

1. `agv_documents` was missing a staff UPDATE policy — uploads showed a false
   success toast because the Storage file upload worked but the metadata
   row silently stayed `pending` (Postgres `UPDATE` doesn't error on an
   RLS-blocked 0-row match, unlike `INSERT`, which does).
2. `storage.objects` was missing a staff UPDATE policy for the `upsert`
   case — re-uploading to an existing path is an UPDATE, not an INSERT, and
   only INSERT had been granted.

Both write functions (`changeApplicationStage`, `uploadDocument`) were then
hardened to check that the updated row actually came back, instead of
trusting "no error" as proof of a write. See STATUS.md's "Known issues" for
the standing lesson this taught: migration self-review needs an explicit
"enumerate every table × role × operation" checklist pass, not just a
security-boundary correctness check.

## Standing rules for this project — read before doing anything

- **You (the assistant) write migrations and seed script changes. The user
  is the only one who ever applies migrations** (via Supabase SQL Editor or
  `supabase db push`) **and runs seed scripts**, in their own terminal, with
  their own `service_role` key. **That key must never enter the chat
  session.** This is a hard, explicitly-defended security boundary — the
  user directly asked how to avoid this friction and was told no, because
  the manual-apply-and-report loop is exactly what caught both RLS bugs
  above. If several small migrations are needed, prefer batching them into
  fewer files rather than asking for credentials.
- After each phase or slice, overwrite `STATUS.md` in place using its
  existing template/structure, and give the user a concise chat summary —
  don't just append.
- Git hygiene: stage specific files, never `git add -A`. If unrelated
  pre-existing uncommitted work is sitting in the tree when you're about to
  touch a file, isolate it into its own "carry forward pre-existing work"
  commit first so the real task's commit stays scoped for review.
- **Execution mode: direct, not subagent-driven.** Earlier in this session
  the user questioned whether subagent-driven-development (implementer +
  reviewer dispatch per task) was worth the token cost for well-specified,
  small tasks. Agreed, and switched to direct execution — write code
  yourself, run lint/build yourself, do the security review yourself — for
  the remainder of the project. This is the standing mode going forward
  unless the user says otherwise.
- **`AdminApplicationView` and `UserApplicationView` stay separate
  components**, even though both now have real edit rights. Explicit
  decision: more admin-only features are planned, and unifying them now
  would work against that. Shared logic lives at the data layer
  (`src/lib/supabase/*.ts`); both components call the same functions
  independently. Don't re-propose merging them.
- Verification standard: prove behavior with real per-role sessions in the
  running app (or via direct authenticated REST calls that exercise the
  same code path), not just by reading the code or trusting "no error
  thrown." This is what caught real bugs — treat it as load-bearing, not
  boilerplate.

## Known open items (non-blocking)

- `changeApplicationStage()` is two sequential writes (app update + activity
  insert), not one transaction — accepted simplification, documented in
  code.
- `StatusChip`'s `TIER_DOT` is a dead export.
- A Turbopack AVIF logo warning (cosmetic, pre-existing).
- Admin's write path (as opposed to staff's) wasn't separately click-tested
  this session — same functions already proven for the more-restricted
  staff case, judged redundant, but flagged honestly rather than silently
  assumed.
- Supabase region (Singapore, pending the client's IT team's data-residency
  call) and the dev seed password are both still open, non-blocking,
  carried forward from earlier phases.

## Files worth knowing about

- `STATUS.md` — canonical status doc, read this first.
- `src/lib/supabase/applications.ts` — reads + writes for applications
  (`fetchApplications`, `fetchApplicationByReference`, `findApplicationId`,
  `changeApplicationStage`, `addActivityNote`).
- `src/lib/supabase/access.ts` — grant/revoke functions backing the access UI.
- `src/lib/supabase/documents.ts` — Storage upload/download.
- `src/lib/session.ts` — `Role` type, `PORTAL_ROLES`, dev account list.
- `src/components/admin/AdminApplicationView.tsx`,
  `src/components/UserApplicationView.tsx` — the two (deliberately separate)
  editable views.
- `src/components/admin/AccessMatrix.tsx` — real grant/revoke UI.
- `supabase/migrations/` — most recent: `20260723090000_role_staff_client.sql`,
  `20260723140000_storage_documents.sql`,
  `20260723150000_documents_staff_write.sql`,
  `20260723151500_storage_staff_update.sql`.
- `supabase/seed-users.mjs`, `supabase/seed-domain.mjs` — seed scripts, kept
  in sync with schema/role changes.
