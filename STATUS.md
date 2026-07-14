# AGV Portal — Status
Updated: 2026-07-14 14:23
Phase: Phase 5 — Shared Detail Page + Admin Edit Controls (renumbered: polish is Phase 6, Gemini imagery Phase 7)
State: complete

## Done this session
- Replaced the `/admin/applications/[id]` stub entirely: it now renders the same `ApplicationDetail` the client portal uses, with `canEdit` — via a new `AdminApplicationView` client component (back link + unknown-ID fallback preserved)
- Made application data reactive: new `src/lib/applications.ts` Zustand store (same persist pattern as the session store, key `agv-demo-applications`), seeded from the static mock data via `structuredClone`. The admin gallery, admin detail, and client portal all read from it, so edits propagate everywhere instantly
- Status change control: when `canEdit`, an "Update status" select (all 5 stages, any direction — demo correction path, no forward-only enforcement) sits in the stepper card header. Changing it updates the store immediately, confirms via the existing toast, appends a self-logging "Status moved to X." timeline entry (attributed + dated), and clears the stale `statusNote`
- Add-note control: when `canEdit`, a form below the activity timeline ("Add note — logs as A. Mercer") appends a comment entry timestamped today, in the timeline's existing chronological order and style; submit disabled while empty; toast on success
- Notes/status entries attribute to the signed-in admin's name from the session store (falls back to "A. Mercer")
- Client stays read-only: `/portal` renders `ApplicationDetail` without `canEdit` through a new `ClientPortalView` (store-backed) — verified no select, no note form
- Nice-to-have shipped: "Reset demo data" text button in the header (admin-only, hidden below md so the mobile header keeps fitting) restores the seed — verified it reverts stages, restores original statusNotes, and truncates added timeline entries
- Verified end-to-end: full edit loop (status change → toast/chip/stepper/timeline/store), note flow, gallery chip reflects edits after full reload (persistence), **zero hydration errors reloading with persisted edits**, admin edit visible on the client's `/portal` via quick-switch, reset restores seed across views, unknown-ID fallback intact, no overflow at 375px with the new controls, console/server clean, build clean

## Files added/changed
- `src/lib/applications.ts` — new; reactive persisted applications store (setStage / addNote / resetDemo, hydration flag)
- `src/components/ApplicationDetail.tsx` — `canEdit` now renders the status select + add-note form; wires store actions + session actor; toast copy for both
- `src/components/admin/AdminApplicationView.tsx` — new; admin detail wrapper (store lookup by ID, canEdit)
- `src/app/admin/applications/[id]/page.tsx` — stub removed; thin server page (params/metadata/staticParams) rendering AdminApplicationView in the shell
- `src/components/ClientPortalView.tsx` — new; client portal content backed by the store, read-only
- `src/app/portal/page.tsx` — thin server page rendering ClientPortalView
- `src/components/admin/AdminDashboard.tsx` — gallery reads the store instead of static mock data
- `src/components/AppShell.tsx` — admin-only "Reset demo data" header button

## Decisions made
- Status changes self-log into the activity timeline (matches the seed data's own "Status moved to Under Review" entries) and clear `statusNote`, since the note described the previous state — reset restores the original notes
- Store timestamps are date-only ISO (matches the timeline's existing date-level formatting)
- `mock-data.ts` stays the pure seed (types + data); the store owns runtime state — `generateStaticParams`/`generateMetadata` still read the seed since IDs never change
- Followed the session store's exact persist pattern rather than `skipHydration` — verified empirically: reloading with persisted edits diverging from the SSR seed produces no hydration errors (rehydration lands after first render)
- Reset button hidden below md: the mobile header is already at capacity, and resets during demos happen on the presenting machine

## Known issues / TODO
- Unused analytics/table components still retained in `src/components/admin/` (per the Phase 4 re-scope; delete in cleanup if "Insights" never lands)
- Turbopack AVIF build warning (cosmetic; runtime verified) — carried over
- Reduced-motion pass in a real browser still pending — now Phase 6 polish

## Blocked on / needs a decision
- none

## Next step
- Phase 6: polish pass — motion, empty/loading states, responsiveness, accessibility (reduced motion, visible focus states) (on your prompt)
