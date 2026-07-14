# AGV Portal — Status
Updated: 2026-07-14 21:47
Phase: Phase 6 — Multi-User Access, Visibility & "Client" → "User" Rename
State: complete

## Done this session
- Terminology fix: the portal role is now `user`, not `client`, everywhere it refers to who's using the app
  - `Role` type `'admin' | 'client'` → `'admin' | 'user'`; `switchRole` → `switchAccount`; `ClientPortalView` → `UserPortalView`; `expect="client"` → `expect="user"`
  - UI copy updated: role chip (USER), login rows, quick-switch — all read "User"
  - Left untouched: the application `clientName` field and its "Client:" meta label (the real-world engaging organization — different concept)
  - Dropped the "Transport for NSW contact" framing; demo users are AGV staff granted access to engagements
- Three demo accounts (was two): admin (A. Mercer), user1 (S. Whitfield), user2 (R. Santiago) — login rows + quick-switch (now cycles all 3) reflect them
- Data model: extended the reactive store with a `users` collection (id/email, name, role, `visibleApplicationIds`) + a `toggleVisibility(userId, appId)` action; seeded with user1 → Parramatta + Western Harbour, user2 → Manila. Added pure helpers `visibleApplicationsFor` / `isApplicationVisible`. `resetDemo` and persistence now cover users too
- Generalized the gallery: extracted `ApplicationGallery` (eyebrow/title/subtitle/applications/hrefBase/emptyState props) from the admin dashboard; both `/admin` and `/portal` now reuse it — no duplicated card markup
- `/portal` renders `UserPortalView` — a gallery of only the signed-in user's visible applications, with a plain empty state for zero-visibility (not hit by either demo account today)
- `/portal/applications/[id]` (new) renders the shared `ApplicationDetail` read-only via `UserApplicationView`, with an authorization check — a user hitting an application outside their visible list gets a "Not available" state instead of the content
- `/admin/access` (new): a users × applications checkbox matrix, instant-apply toggles (no save step), Signal on the checked/active cell, live "N of 3 visible" per row. Added an admin nav strip (Applications | Access tabs, active-state via pathname) between the two views in the shell
- Admin still sees all 3 applications regardless of visibility settings
- Verified end-to-end in the browser (details below); build clean, zero console errors

## Files added/changed
- `src/lib/session.ts` — Role rename; `DEMO_ACCOUNTS` now a 3-entry array of AGV staff (id/role/email/name/title); `accountByEmail`, `nextAccount`, `switchAccount` (cycles)
- `src/lib/applications.ts` — `users` collection + `PortalUser` type, `toggleVisibility`, `visibleApplicationsFor`/`isApplicationVisible`, users in resetDemo + persistence
- `src/lib/mock-data.ts` — removed the obsolete `clientAccountEmail` field + `applicationsForClient` helper (kept `clientName`)
- `src/components/ApplicationGallery.tsx` — new; the shared gallery
- `src/components/admin/AdminDashboard.tsx` — thin wrapper over ApplicationGallery (all apps)
- `src/components/UserPortalView.tsx` — new; portal gallery of visible apps (replaces ClientPortalView, now deleted)
- `src/components/UserApplicationView.tsx` — new; read-only detail with visibility auth check
- `src/app/portal/page.tsx` — renders UserPortalView
- `src/app/portal/applications/[id]/page.tsx` — new; user detail route
- `src/components/admin/AccessMatrix.tsx` + `src/app/admin/access/page.tsx` — new; visibility matrix + route
- `src/components/AppShell.tsx` — admin nav tabs (Applications | Access), header shows name · title, role rename
- `src/components/QuickSwitch.tsx` — cycles through all 3 accounts
- `src/app/page.tsx` — 3 login rows, "User" labeling, updated error/help copy
- `src/components/ApplicationDetail.tsx` / `admin/AdminApplicationView.tsx` — "client portal" → "user portal" in comments

## Decisions made
- Demo users reuse names already in the data (S. Whitfield leads Parramatta, R. Santiago leads Manila) — the assigned staff are the actual leads, which reads coherently
- Auth on the user detail route is a client-side "Not available" state (not a redirect) — no flash, and it visibly demonstrates the guard working; the page still prerenders (generateStaticParams) with the check enforced at runtime
- Users live in the applications store (domain data the admin edits), keyed by email to the session accounts (auth identity) — intentional split, joined on email
- Access matrix uses no per-toggle toast (would be noisy across many checkboxes); the checkbox state + live "N of 3 visible" per row is the feedback. Instant-apply matches the Phase 5 no-save pattern
- Admin nav is a slim second row under the header (tabs underline-style), admin-only; keeps the busy top bar uncluttered and scales on mobile
- Header identity now shows name · title (all AGV staff) instead of name · org

## Known issues / TODO
- Unused analytics/table components still retained in `src/components/admin/` (from the earlier gallery re-scope)
- Turbopack AVIF logo build warning (cosmetic; runtime verified) — carried over
- Reduced-motion pass in a real browser still pending — Phase 8 polish

## Blocked on / needs a decision
- none

## Next step
- Phase 7: Supabase/realtime migration (separate track), then Phase 8 polish, Phase 9 Gemini imagery
