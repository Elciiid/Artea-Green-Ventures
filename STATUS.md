# AGV Portal — Status
Updated: 2026-07-14 03:33
Phase: Phase 3 — Real Logo + Client Dashboard
State: complete

## Done this session
- Swapped the placeholder logo for the real brand asset (`public/images/Artea Logo Assets-09.avif` — AVIF, not PNG). Inspected it first by pixel-sampling through a canvas: 266×85, fully transparent background, content ~100% white — a knockout lockup built for dark themes, so it's used as-is with no plate/recolor treatment. Wired via `next/image` into the login screen, app header, and stub page header, with a "Field Portal" product tag beside the lockup
- Favicon kept: the asset folder has no standalone icon variant, and the contour-ring `icon.svg` is a deliberate piece of the system
- Built `ApplicationDetail` — the reusable single-application view (`app` + `canEdit` props, read-only default; Phase 4 layers admin edit controls via `canEdit`, which is accepted but intentionally unused now). Contains:
  - Header: case ID, status chip, title, service line, meta grid (sector, location, client, lead, submitted, coordinates in mono)
  - Status stepper with position-relative coloring (distinct from the chip's tier system): completed = Contour + check, current = Amber with a pulsing ring (CSS keyframes, disabled under `prefers-reduced-motion`), upcoming = dim Ash outline; animated Contour progress line; `aria-current="step"`
  - Documents: file-type badge (PDF/XLS/ZIP from extension), name, kind · size · upload date ("awaiting upload" when pending), received→"View" button firing a toast ("Preview isn't wired up in this demo.", auto-dismisses ~2.6s), pending→Amber chip, "N of M received" counter
  - Activity: vertical timeline with rail + dots (system entries dimmer), date — actor, description
- `/portal` now renders `ApplicationDetail` for the client's single application (plus a defensive no-application empty state); eyebrow carries the org name
- Extended mock data: `DocumentItem.uploaded?` ISO dates for received documents (aligned with timeline events)
- Fixed a real mobile bug found during verification: the documents/activity cards overflowed 375px because grid items default to `min-width: auto` — added `min-w-0` to them, and prophylactically to the admin dashboard's funnel/sector grid items (same pattern)
- Verified end-to-end: logo rendering on all surfaces (right ratio, no layout shift), stepper states/labels/colors, documents list content, toast show + auto-dismiss, timeline entries, quick-switch/sign-out still good, Phase 2 stub route untouched, no horizontal overflow at 375px on any route, zero console/server errors, build clean

## Files added/changed
- `src/components/Logo.tsx` — Wordmark now renders the real asset via `next/image` (explicit 266×85 dims); contour-ring `Mark` removed (dead code; favicon is a separate static file)
- `src/components/ApplicationDetail.tsx` — new; the reusable detail view described above
- `src/app/portal/page.tsx` — rewritten to render ApplicationDetail
- `src/components/AppShell.tsx` — Wordmark prop rename (`hideTagOnMobile`), role chip hidden on xs to make room for the wider logo
- `src/components/admin/AdminDashboard.tsx` — `min-w-0` on chart grid items
- `src/lib/mock-data.ts` — `DocumentItem.uploaded?` + dates on received docs
- `src/app/globals.css` — `step-pulse` keyframes with reduced-motion off-switch

## Decisions made
- Logo treatment: none needed — the file is a white knockout lockup on a transparent background (verified by sampling pixels, not assumed), which holds maximum contrast on Void/Pine. The brief's Bone-plate fallback was for a dark-on-light asset; this isn't one
- Turbopack can't decode AVIF at build time (emits a warning + placeholder 100×100 intrinsic size), but the runtime image optimizer serves it fine — passed explicit `width/height` so pre-load layout keeps the true aspect ratio
- Kept a "Field Portal" text tag beside the company lockup so the product keeps its name on screen; tag hides on mobile in the header
- Stepper "current" = the application's stage exactly; stages strictly before it are completed (Report Issued as current pulses Amber even though its chip tier is "resolved" — the two systems are intentionally different lenses)
- Timeline stays chronological (oldest → newest), reading as a story top-to-bottom; trivial to flip later if the Phase 4 admin view wants newest-first
- Toast is component-local (no global toast system) — smallest thing that satisfies "View can just show a small toast"

## Known issues / TODO
- Turbopack AVIF build warning (cosmetic; runtime verified correct) — would vanish if the asset ever ships as PNG/WebP too
- Stepper labels at 375px rely on wrapping within 5 columns; holds for current stage names, revisit if labels get longer (Phase 5)
- Reduced-motion pass in a real browser still pending (Phase 5, carried over)

## Blocked on / needs a decision
- none

## Next step
- Phase 4: shared application detail page — reuse `ApplicationDetail` at `/admin/applications/[id]` with `canEdit` controls (status change, add note) (on your prompt)
