# AGV Portal — Status
Updated: 2026-07-13 21:21
Phase: Phase 1 — Kickoff (scaffold, design system, login, routing shell)
State: complete

## Done this session
- Scaffolded Next.js 16 (App Router) + TypeScript project at `E:\Work\Code\AVG-Portal`, builds clean
- Design tokens (Void/Pine/Signal/Contour/Amber/Bone/Ash + Archivo/Inter/JetBrains Mono) wired into Tailwind v4 via `@theme` in globals.css
- Signature motif built: seeded deterministic topographic contour generator (`topo.ts`) + `TopoField` component — glowing nested rings with a Signal "index contour", plotter-style draw-in, pointer parallax, both disabled under `prefers-reduced-motion`
- Login screen: split "field sheet" layout (terrain canvas + instrument panel), one-click demo access rows, manual form (either address, any password), inline error for unknown emails, surveyor corner ticks, site-coordinate microdata
- Mock session store (Zustand + localStorage persist): signIn/signOut/switchRole, role guard, hydration gate
- Routing shell: `/admin` and `/portal` placeholder dashboards inside a shared `AppShell` (header with role chip, ⇄ quick-switch, sign out; topo band; demo-notice footer)
- Mock data for all 3 applications (docs + 3–5-entry timelines each) in `mock-data.ts`
- Verified end-to-end in the browser: login (both roles, one-click + manual, case-insensitive), role guard bounce (/admin as client → /portal), quick switch both directions, sign out, session persistence across reload, no console errors, no horizontal overflow at 375px on all routes

## Files added/changed
- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore` — project scaffold (Next 16.2.10, Tailwind 4, Framer Motion 12, Zustand 5)
- `src/app/globals.css` — design tokens as Tailwind `@theme` values, dark base styles, focus-visible ring, film-grain overlay
- `src/app/layout.tsx` — Archivo/Inter/JetBrains Mono via next/font, metadata, theme color
- `src/app/page.tsx` — login screen
- `src/app/admin/page.tsx`, `src/app/portal/page.tsx` — placeholder dashboards (admin: live mock counts + Phase 2 empty state; client: their application card with status chip)
- `src/app/icon.svg` — favicon (contour rings)
- `src/lib/topo.ts` — deterministic contour generator
- `src/lib/session.ts` — demo accounts + mock session store
- `src/lib/mock-data.ts` — 3 applications, pipeline stages, types
- `src/components/TopoField.tsx`, `Logo.tsx`, `AppShell.tsx`, `QuickSwitch.tsx`, `StatusChip.tsx`
- `README.md`, `STATUS.md`, `.claude/skills/verify/SKILL.md` — docs + verification recipe

## Decisions made
- Zustand (with persist) over React Context — session survives refresh during demos, no provider nesting
- Login lives at `/` and auto-forwards when already signed in; one-click account rows double as the login-screen quick switch, plus a persistent ⇄ switch in the app header
- Mock data for all 3 applications written now (Phase 1 lists it) — placeholder dashboards read live counts from it, but tables/detail views stay unbuilt per phase scope
- Statuses map to palette: Under Review/pending → Amber, Report Issued/approved → Contour, Site Visit → Signal, Submitted/Closed → Ash
- Topo contours are generated with a seeded PRNG (not static SVG assets) so density/placement is tunable per surface and SSR markup matches hydration
- Dates formatted manually ("18 Jun 2026") — `toLocaleDateString` gave inconsistent month abbreviations across environments
- No test framework this phase — pure UI demo scope, nothing requested in the brief
- Dev server pinned to port 3170 to avoid clashing with other local projects

## Known issues / TODO
- Reduced-motion behavior is implemented but not yet exercised in a browser with the preference on (Phase 5 a11y pass will cover it)
- Login left-panel headline could use a dedicated tablet breakpoint pass (fine at 375px and desktop) — fold into Phase 5 polish
- Placeholder art only; Gemini-generated imagery is Phase 6

## Blocked on / needs a decision
- none

## Next step
- Phase 2: Admin dashboard — applications table, filters, stats, analytics (on your prompt)
