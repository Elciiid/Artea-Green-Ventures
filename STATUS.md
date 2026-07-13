# AGV Portal — Status
Updated: 2026-07-14 03:10
Phase: Phase 2 — Admin Dashboard
State: complete

## Done this session
- Course-correction applied first: pipeline statuses collapsed to 3 semantic tiers — Ash = Submitted (neutral), Amber = Under Review + Site Visit (active), Contour = Report Issued + Closed (resolved). Signal no longer appears on any badge; it now marks only interactive affordances (active filter pills, active sort header, reset buttons, focus rings, hovers)
- Also neutralized the header role chip (was Signal for admin / Contour for client) — it's informational, not clickable, so it now wears ash/bone
- Replaced the `/admin` placeholder with the real dashboard:
  - Stat strip: total, per-tier counts, and avg days in pipeline — all computed from mock data (currently 3 / 1 / 1 / 1 / 56); kinetic count-up on mount, instant under reduced motion
  - Cumulative pipeline funnel (reached-or-passed per stage, via stage-index comparison): resolves to 3 → 2 → 1 → 1 → 0 from live data, tier-colored bars, direct labels, hover/focus tooltip listing the applications at each stage
  - Sector breakdown: monochrome single-series bars (Transportation 2, Social Infrastructure 1) with per-sector tooltips
  - Applications table: client-side sort on all 7 columns (aria-sort), tier + sector filter pills, search across name/client/case-ID, live "N of M shown" count, reset, topo empty state — rows reflow via Framer Motion layout animation (AnimatePresence popLayout), disabled under reduced motion
  - Rows are real links to `/admin/applications/[id]`
- Built the stub detail route: title, status chip, meta strip, "full detail view arrives in Phase 4" notice, unknown-ID fallback state; the 3 known IDs prerender via generateStaticParams
- Ran the dataviz palette validator on the tier trio against the dark surface: CVD separation ΔE 36.4 (target ≥12) and contrast ≥3:1 both pass; the two "categorical palette" failures don't apply to status colors (ash reading gray is the point of the neutral tier) and every status color always ships with a text label
- Verified end-to-end in the browser: stat math, funnel/sector numbers, all sorts/filters/searches/reset, empty states, row → stub navigation, unknown-ID state, chip tier classes, no Signal on badges, no horizontal page overflow at 375px (table scrolls its own container), zero console/server errors

## Files added/changed
- `src/lib/mock-data.ts` — added `Tier`, `TIER_OF_STAGE`, `TIERS`, `stageIndex()`
- `src/lib/format.ts` — new; shared locale-stable `formatDate` (portal page now imports it)
- `src/components/StatusChip.tsx` — 3-tier color mapping; exports `TIER_TEXT`/`TIER_DOT` for reuse
- `src/components/AppShell.tsx` — role chip neutralized
- `src/components/admin/KineticNumber.tsx` — new; count-up counter (reduced-motion aware; shows the real value immediately if mounted in a hidden tab, plays when first visible)
- `src/components/admin/StatStrip.tsx` — new; computed overview stats
- `src/components/admin/PipelineFunnel.tsx` — new; cumulative funnel
- `src/components/admin/SectorBars.tsx` — new; sector breakdown
- `src/components/admin/ApplicationsTable.tsx` — new; sortable/filterable/searchable table with layout-animated rows
- `src/components/admin/AdminDashboard.tsx` — new; dashboard composition + entrance motion
- `src/app/admin/page.tsx` — now a thin server wrapper (metadata + shell + dashboard)
- `src/app/admin/applications/[id]/page.tsx` — new; Phase 4 stub with generateStaticParams/generateMetadata
- `src/app/portal/page.tsx` — uses shared formatDate
- `.claude/skills/verify/SKILL.md` — verification gotchas expanded (hidden-tab rAF stall findings)

## Decisions made
- Extended the Signal rule to the header role chip (was Signal/Contour): it's a non-interactive badge sitting between two real buttons, so it went neutral. The topo "index contour" accent stays Signal — it's the approved background motif, not a UI element
- Funnel bars wear tier status colors (state semantics, always direct-labeled — sanctioned status-color use); sector bars stay monochrome because they're a single series (per-bar rainbow is a chart anti-pattern)
- Table is an ARIA grid of divs (`role="table/row/cell"`, rows are real `<a>` links via `motion.create(Link)`) rather than `<table>` — native `<tr>` animates poorly with Framer layout animations
- Default table sort: submitted, newest first; sort resets direction sensibly per column (dates default desc, text asc)
- Search matches name + client + case ID (forgiving beats literal "name only" for demos)
- KineticNumber is visibility-aware: mounted in a hidden/background tab it shows the true value immediately and plays the count-up when the tab first becomes visible (also makes headless verification honest)
- Kept "avg days in pipeline" as days-since-submission averaged over all applications — simple, real math as specified

## Known issues / TODO
- Chart entrance/exit animations and AnimatePresence row-exits can't complete while a tab reports `visibilityState: "hidden"` (rAF paused) — self-resolves on visibility; only affects headless contexts, noted in the verify skill
- Funnel/sector hover tooltips are anchored below each bar; fine at current heights, revisit if funnel rows multiply (Phase 5)
- Table columns scroll horizontally on mobile inside their own container; a stacked card layout for small screens is a Phase 5 candidate
- Reduced-motion still needs a real `prefers-reduced-motion` browser pass (Phase 5, carried over)

## Blocked on / needs a decision
- none

## Next step
- Phase 3: Client dashboard — single application view (on your prompt)
