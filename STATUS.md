# AGV Portal — Status
Updated: 2026-07-23 19:10
Phase: 18 — "AGV Home" hub, plus a git-history backfill that predates it
State: See the breakdown below — this update covers two different kinds of work with two different confidence levels. **Phase 18 itself is independently verified**: every RLS row below was tested with a real per-role sign-in and a reload/direct-query check, not assumed from reading the migration. **The backfilled 10a/account-settings/register-redesign work (committed this session but built in an earlier, separate session) is build-verified only** — `npm run build` passes clean and no dangling references remain, but I did not personally re-run that earlier work's own per-role verification; take its correctness on the earlier session's word, not this one's.

## Why this update covers more than Phase 18
When Phase 18 started, STATUS.md still said the latest phase was 10b-3 and next up was Phase 17 — but the actual repo already had 10a (real Supabase auth), account settings + display preferences + MFA, a demo banner, dev-only accessibility tooling, and the Phase 16 register redesign, all done in a separate session and never committed. Worse: two files that already-committed code depended on (`src/lib/supabase/client.ts`, `src/components/ApplicationRegister.tsx`) had never been staged either, so committed git history was non-buildable from a fresh clone since the 10b-2 commit — it only ever worked locally because the files happened to exist on disk. Per your instruction, none of this was silently resolved; it was flagged back to you, then fixed by committing everything in five scoped commits (see `git log`) before Phase 18 touched anything. STATUS.md is being backfilled now, at your explicit direction, rather than before Phase 18 started.

## What's in the backfilled baseline (not built this session; committed this session)
- **10a — real Supabase email/password auth** on the login page, replacing the old "any password" mock. Dev-only one-click sign-in and the QuickSwitch account switcher both use a shared dev seed password over the same real auth call, gated behind `showDevTools()`.
- **Account settings + display preferences**: `/account` page with password change and TOTP MFA enrollment; text-size/motion/theme preferences (Zustand store, persisted to `agv_profiles`), applied via a pre-paint no-flash script so there's never a flash of the wrong theme/size.
- **Demo banner + dev-only accessibility tooling**: environment flag banner, `axe-core` console auditing in development only.
- **Phase 16 register redesign**: `ApplicationRegister` (a shared, sortable table) replaced the old `ApplicationGallery` (Phase 4) and `admin/ApplicationsTable` (Phase 2); five now-unused stat-overview viz components (`SitePhoto`, `admin/KineticNumber`, `admin/PipelineFunnel`, `admin/SectorBars`, `admin/StatStrip`) were removed in the same pass with zero remaining references anywhere in `src/`, confirmed by grep before deleting.

None of the above was re-verified per-role by me this session — I confirmed the tree builds and lints clean and that nothing references the deleted components, and committed it. If something in that surface turns out broken, that's this backfill's blind spot, not Phase 18's.

## Phase 18 — AGV Home hub (built and verified this session)

### Scope
Rename "AGV Portal" → "AGV Home" in user-facing copy (browser tab title, the tag beside the logo in the shared sidebar/header, the AppShell loading state). This is global — client sees "AGV Home" as the product name too, even though client gets no Home hub — per the brief, it's a placeholder name change, not a role-scoped feature. The tracker itself (register, applications, documents, access) is untouched.

New Home hub, admin/staff only:
- **Home landing** (`/home`) — welcome header, latest-3 announcement preview, quick links to directory/resources.
- **Announcements** (`/home/announcements`) — full list; admin gets an inline post form, staff gets read-only.
- **Staff directory** (`/home/directory`) — name + role for admin/staff profiles.
- **Resources** (`/home/resources`) — static curated list (see Decisions).

`roleHome()` now diverges for the first time: admin/staff → `/home`, client → `/portal` (unchanged). Sidebar gets a new "Home" link above the existing "Records" group, admin/staff only — client's sidebar is untouched (still just Applications + Account).

### New visual identity
Distinct from the tracker's Phase 16 institutional register, scoped only to the four Home surfaces — AppShell's shared sidebar/header/footer keep the tracker's normal light/dark chrome unchanged. Tone drawn from arteagreenventures.com (browsed directly): warm sage greens (`#2F7040`/`#3F7652` family) on cream, fully-pill buttons, bold rounded headings, photography-forward layout, human/mission-driven copy. Implemented as a second, **fixed** (non-theme-reactive) token set in `globals.css` — the source site has no dark mode either, and building one for Home was out of this phase's timebox; flagged as a fast-follow, not silently skipped. No usable existing photography (the three hero images in `public/images/site/` are tied to specific tracker applications, not generic), so the Home landing hero is a warm gradient placeholder — real photography is a flagged pending item, not faked.

## Decisions made
- **Resources is a static list, not a table.** The brief explicitly said "not a CMS"; a table would be a fifth RLS surface plus admin-write UI under a hard deadline for content that changes rarely. `src/lib/resources.ts` is a hardcoded array; move it to a table later if self-serve editing turns out to matter. hrefs are `#` placeholders, not fabricated real links.
- **No `pinned` column on `agv_announcements`.** Ordering by `created_at desc` is enough for a first pass — the brief said add it "only if the feed needs it," and nothing established that need yet.
- **Home's new identity has no dark-mode variant.** Fixed warm palette regardless of the app's theme toggle. Matches the source site (also single-mode); revisit if dark mode on Home specifically gets requested.
- **Route guard for `/home/*` is the same mechanism used everywhere else in this app** — `AppShell`'s `expect` prop, a client-side redirect once the session hydrates. This project has no `middleware.ts` and never has; every existing role gate (`/admin`, `/admin/access`, `/portal`, `/portal/applications/[id]`) works this way, so Home isn't a weaker pattern than the rest of the app. Independently verified below, not assumed sufficient.
- **A directory query needs an explicit role filter even with RLS in place**, because RLS has no concept of "this specific query is for a staff directory" — the new `agv_profiles` staff-read-all policy makes every profile row (including client) readable to staff at the database level; `fetchDirectory()` additionally filters `role IN ('admin','staff')` so client accounts never surface in what's supposed to read as an internal directory. This was flagged in review before the migration was written, not found during verification.
- **`assertRowReturned()` extracted to `src/lib/supabase/assert-write.ts`.** The "UPDATE doesn't error on a 0-row RLS match" check had been written inline twice already (10b-3's `agv_documents` and `storage.objects` fixes); the brief asked for a shared helper rather than a third ad hoc copy. `applications.ts`'s `changeApplicationStage` and `documents.ts`'s `uploadDocument` were both refactored onto it. `createAnnouncement` doesn't use it — INSERT throws on a failing RLS check, so there's nothing for it to catch.

## RLS matrix — table × role × operation

| Table | Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `agv_announcements` (new) | admin | ✅ tested | ✅ tested | — (no update path built) | ✅ tested |
| `agv_announcements` | staff | ✅ tested | ✅ tested — **rejected**, 403 `42501` | n/a | n/a |
| `agv_announcements` | client | ✅ tested — RLS returns `[]`, not an error (expected SELECT behavior) | n/a (no UI path; not separately tested) | n/a | n/a |
| `agv_profiles` (new "staff read all" policy) | staff | ✅ tested — returns all 4 rows including client, confirming the policy is broad by design (see Decisions) | — | — (own-row-only update from 10a unchanged, not re-tested) | — |
| `agv_profiles` | client | ✅ tested — only own row (1 of 4) returned, confirming the new staff policy doesn't leak to client | — | — | — |

Every ✅ above is a real sign-in (password grant against Supabase auth) plus a direct REST call or, for the admin write path, an actual UI form submission verified to persist across a reload — not inferred from the migration.

## Files added/changed (Phase 18 only — see `git log` for the backfill commits)
- `supabase/migrations/20260724090000_home_announcements.sql` — `agv_announcements` table + RLS, plus the `agv_profiles` staff-read-all policy.
- `src/lib/supabase/assert-write.ts` — new shared helper (see Decisions).
- `src/lib/supabase/applications.ts`, `src/lib/supabase/documents.ts` — refactored onto `assertRowReturned()`.
- `src/lib/supabase/home.ts` — new; `fetchAnnouncements`, `createAnnouncement`, `fetchDirectory`.
- `src/lib/resources.ts` — new; static resources list.
- `src/lib/session.ts` — `roleHome()` now diverges by role (see Scope).
- `src/components/AppShell.tsx` — new `HOME_ITEM`, rendered above "Records" for admin/staff only; loading copy updated to "AGV Home."
- `src/components/Logo.tsx`, `src/app/layout.tsx` — "AGV Portal"/"AGV Field Portal" → "AGV Home" in the wordmark tag and page metadata.
- `src/components/home/` — new directory: `HomeShell.tsx` (shared warm-toned wrapper + panel/pill-link primitives), `HomeLanding.tsx`, `AnnouncementsPage.tsx`, `DirectoryPage.tsx`, `ResourcesPage.tsx`.
- `src/app/home/`, `src/app/home/announcements/`, `src/app/home/directory/`, `src/app/home/resources/` — new routes, each wrapped in `AppShell expect={["admin","staff"]}`.
- `src/app/globals.css` — new fixed Home palette tokens (`--color-home-*`), additive only; existing tracker tokens untouched.

## Known issues / TODO
- Home has no dark-mode variant (see Decisions) — the rest of the app's theme toggle still works, it just doesn't visually affect Home's content area.
- No real photography for Home yet — hero is a placeholder gradient, flagged rather than faked.
- Resources is static; revisit as a table only if admin wants self-serve editing without a code change.
- `agv_announcements` has no UPDATE path built (admin can create/read/delete via the UI; edit-in-place wasn't asked for and wasn't built) — the RLS policy allows it (`for all`), so it's available if a future phase wants it, but it's untested because there's no UI caller.
- Client's announcement-read denial and the admin-write-form path were each tested via direct REST/API, not by clicking through as that role in the browser UI end-to-end for every combination — the ones that matter for the locked decisions (client rejected on write, client redirected off `/home`, staff rejected on write, directory excludes client) were all tested for real; see the RLS matrix for exactly which.
- Carried over, still open: `StatusChip`'s `TIER_DOT` dead export, the Turbopack AVIF logo warning, admin's application-edit write path not separately click-tested (from 10b-3, still true).

## Blocked on / needs a decision
- Nothing blocking. Home's dark-mode variant and real photography are flagged fast-follows, not blockers.
- Carried forward, still open, non-blocking: Supabase region (Singapore, pending LGU IT's data-residency call), dev seed password rotation before any real deploy.

## Verification — proven empirically (Phase 18)
All via real per-role Supabase sessions (password grant against `/auth/v1/token`, same mechanism the app itself uses), either through direct authenticated REST calls or actual UI interaction with a reload/re-query to confirm persistence — not inferred from the code or the migration.

- **Admin creates an announcement via REST**: `201`, row returned with correct `created_by`.
- **Admin creates an announcement via the real UI form** (typed into the actual inputs, real click on Submit): appeared in the list immediately, **and survived a full page reload** — a real database write, not local-only state.
- **Admin deletes** (cleanup of the two test announcements above): `200`, confirmed both removed on reload.
- **Staff reads announcements**: `200`, sees the admin-posted row.
- **Staff attempts to create an announcement**: `403`, `"new row violates row-level security policy for table \"agv_announcements\""` — hard rejection, not a silent no-op (this is an INSERT, so Postgres errors immediately; no `assertRowReturned` check was needed here).
- **Staff reads all `agv_profiles` rows directly** (bypassing the app's query-layer filter, hitting the RLS grant alone): `200`, 4 rows returned including the client account — confirms the policy is exactly as broad as intended, which is *why* the query-layer filter is required.
- **Staff directory page in the real UI**: exactly 3 entries (1 admin, 2 staff), client account correctly absent — confirms the query-layer filter works end-to-end, not just in isolation.
- **Client reads announcements**: `200` but `[]` — RLS SELECT denial returns empty, not an error, which is expected Postgres behavior and not a bug.
- **Client reads `agv_profiles`**: only their own row returned (1 of 4) — confirms the new staff policy doesn't affect client's existing own-row-only access.
- **Client navigates directly to `/home`** (real UI, not just checking the sidebar hides the link): client-side redirect fired, landed on `/portal` with the Applications tracker rendered — confirmed via `window.location.href` and the rendered page content, not assumed from the sidebar being hidden.
- **Sidebar contents per role, read from the live DOM**: admin — Home, Applications (`/admin`), User access, Account. Staff — Home, Applications (`/portal`), Account. Client — Applications (`/portal`), Account only (no Home link).
- **Global rename**: browser tab title reads "AGV Home" on both the login page and every authenticated route, confirmed via the live page title, not just by reading the source.
- `npm run build` and `npm run lint` both pass clean after every change in this phase, most recently after the `HomeLanding` welcome-text fix (see below).

One real bug found and fixed during verification (not a hypothetical): the Home landing headline used `account.name.split(" ")[0]` to get a first name, but this project's demo accounts are styled as initials ("A. Mercer", "S. Whitfield") — splitting on space returns "A." and the template added another period, rendering "Welcome back, A..". Fixed by using the full name instead of trying to extract a first name.

## Next step
No fixed next phase named yet. Fast-follow candidates flagged above (Home dark mode, real photography, resources-as-a-table) are optional, not scheduled. Whoever picks this up next should treat this STATUS.md, not memory of what "usually comes next," as ground truth — that's the whole reason this update exists.
