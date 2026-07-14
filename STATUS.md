# AGV Portal — Status
Updated: 2026-07-14 14:11
Phase: Phase 4 (re-scoped) — Simplify Admin to a Navigation Gallery
State: complete

## Done this session
- Removed the Phase 2 analytics (`StatStrip`, `PipelineFunnel`, `SectorBars`) and the sortable/filterable/searchable `ApplicationsTable` from the `/admin` composition. The component files are retained, unused, in `src/components/admin/` in case an opt-in "Insights" view is wanted later — only `AdminDashboard.tsx` changed
- Replaced `/admin` with an editorial card gallery: one large card per application (3 total), each with case ID, tier-colored status chip (with note), title, service line, sector tag, location, lead, submitted date, and a hover arrow — the entire card is a link to `/admin/applications/[id]`
- Card presence: each card carries its own topographic terrain, seeded from the case ID (all 3 verified unique), masked to fade in from the right, brightening on hover; staggered entrance animation, disabled under `prefers-reduced-motion`; Signal appears only on hover/interactive states per the color rule
- Page header simplified to "Applications" with a live count line ("3 active engagements across AU and PH…")
- `/portal` untouched; `/admin/applications/[id]` still the Phase 2 stub, queued for the next prompt
- Verified in the browser: 3 cards with correct content/links, all analytics + table absent from the DOM, click-through to stub and back, unique terrain per card, no horizontal overflow at 375px, zero console/server errors, clean build

## Files added/changed
- `src/components/admin/AdminDashboard.tsx` — rewritten as the gallery (header + 3 motion Link cards); no longer imports StatStrip/PipelineFunnel/SectorBars/ApplicationsTable
- (retained, unused: `StatStrip.tsx`, `PipelineFunnel.tsx`, `SectorBars.tsx`, `ApplicationsTable.tsx`, `KineticNumber.tsx` — KineticNumber is only consumed by StatStrip)

## Decisions made
- Cards are full-width stacked rows rather than a 3-column grid — with only 3 items, wide editorial rows give each application presence and a big obvious click target, and they scale down to mobile without a layout change
- Per-card terrain is seeded from the numeric tail of the case ID, so each "site" has a stable, distinct topography — the motif now does navigation work (visual identity per application), not just decoration
- Chip keeps its status note in the gallery ("Report Issued · Approved", "Submitted · Pending documents") — with no table columns, the note carries useful glanceable context
- Coordinates shown on lg+ screens only, as quiet microdata on the meta row

## Known issues / TODO
- Unused analytics/table components remain in the tree (intentional, per prompt); if an "Insights" view is never added, delete them in a cleanup pass
- Turbopack AVIF build warning (cosmetic; runtime verified) — carried over
- Reduced-motion pass in a real browser still pending (Phase 5 polish, carried over)

## Blocked on / needs a decision
- none

## Next step
- Next prompt: the shared application detail page — reuse `ApplicationDetail` at `/admin/applications/[id]` with `canEdit` controls (status change, add note)
