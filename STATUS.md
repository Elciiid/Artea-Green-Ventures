# AGV Portal — Status
Updated: 2026-07-14 22:39
Phase: Phase 8 (final) — Sydney Gateway Swap + Hero Imagery with Corrected Treatment
State: complete

## Done this session
- **Content swap:** Application #3 (previously the Manila social-housing flood assessment) is now **Sydney Gateway — Environmental Compliance Audit** · Transportation · Sydney, AU · Transport for NSW · stage *Submitted / Pending documents* (pipeline spread preserved: Under Review / Report Issued / Submitted)
  - New case ID `AGV-2026-0161` following the existing `AGV-2026-nnnn` convention; submitted 08 Jul 2026; coordinates -33.9268 / 151.1710 (St Peters / airport interchange)
  - Lead kept as R. Santiago — user2 *is* R. Santiago, so the assigned staff member remains the project lead, which keeps the access-matrix story coherent
  - Invented documents (EIS Rev A received; Air Quality & Noise Assessment and St Peters Contaminated Land Survey pending) and a 3-entry timeline, matching the tone/detail of the other two applications
  - Visibility slot untouched: user2 still has exactly this one application; user1 still has Parramatta + Western Harbour
- **Identifier rename:** the routing identifier for an application *is* its case ID, so `AGV-2026-0155` → `AGV-2026-0161` everywhere it's used — routes (`/admin/applications/[id]`, `/portal/applications/[id]` both prerender the new ID), the store's seeded `visibleApplicationIds`, and the hero filename mapping (`app-sydney-gateway-hero.*`). Repo-wide case-insensitive grep for `manila` now returns **only** this STATUS.md changelog line — no live code, data, routes or assets
- **Persisted-state migration:** bumped the applications store to `version: 2` with a `migrate` that re-seeds. Without it, any browser holding demo state from a previous session would have resurrected the deleted Manila record (and pointed user2's visibility at a dead ID). Verified by planting a stale v1 store containing Manila and confirming it was discarded and re-seeded
- **Hero imagery wired up, with the treatment split corrected:**
  - `login-hero.jfif` (1376×768, mean luminance 0.09) is Gemini-generated glowing-contour terrain already in-palette → used **unfiltered**; only legibility gradients sit over it. The SVG TopoField motif is kept at reduced opacity so the pointer parallax still works without competing with the art
  - `app-parramatta-hero`, `app-western-harbour-hero`, `app-sydney-gateway-hero` are real daylight site photography (a red-liveried light rail tram, an aerial of the Harbour Bridge, the Sydney Gateway bridge) at luminance 0.19–0.47 → run through the full `SitePhoto` treatment: `grayscale contrast-125 brightness-[0.42]`, a Contour duotone via `mix-blend-color` at 60%, then a Void wash at 45%
  - Photos appear as masked accent panels on the gallery cards (contour lines riding over them) and as a quiet accent behind the detail-page title
- Verified end-to-end in the browser: correct photo per application and treatment applied (login hero confirmed *without* it), full Sydney Gateway content on the detail page, user2's portal showing exactly Sydney Gateway, stale-store migration, no horizontal overflow at 375px, zero console errors, clean build

## Files added/changed
- `src/lib/mock-data.ts` — Manila record replaced by Sydney Gateway (new ID, docs, timeline, coords); added a `hero` field to `Application` and mapped all three photos
- `src/lib/applications.ts` — user2's seeded visibility → `AGV-2026-0161`; persist `version: 2` + `migrate` re-seed
- `src/components/SitePhoto.tsx` — new; the photo treatment pipeline (real photography only)
- `src/components/ApplicationGallery.tsx` — treated hero panel on each card, under the contour lines
- `src/components/ApplicationDetail.tsx` — treated hero accent behind the header
- `src/app/page.tsx` — login hero rendered unfiltered with legibility scrims; TopoField opacity reduced
- `public/images/site/` — four hero assets committed (were untracked)

## Decisions made
- Split the treatment exactly as briefed: verified by measurement, not assumption — I sampled each asset's luminance/saturation and rendered the pipeline offline to look at it before shipping. The login art is already palette-native (0.09 luminance); running it through the photo filter would have crushed it for nothing
- Source photos are only ~420px wide, so they're used as **masked accent panels**, never full-bleed banners — at these render sizes there's no upscaling softness, and the heavy duotone reads as atmosphere rather than a stretched photo
- The browser pane can't produce screenshots in this environment (its page reports `visibilityState: hidden`, so capture never gets a frame). Rather than ship the treatment unseen, I re-implemented the exact CSS pipeline (grayscale → contrast → brightness → W3C `mix-blend-color` SetLum → Void wash) offline with sharp and inspected the output images
- Kept the "AU + PH" company framing on the login screen: AGV operates in both regions regardless of the current caseload, which is now all Sydney

## Known issues / TODO
- Unused analytics/table components still retained in `src/components/admin/` (from the earlier gallery re-scope)
- Turbopack AVIF build warning (cosmetic; runtime verified correct) — carried over
- Reduced-motion pass in a real browser still pending (the code paths exist and are wired to `prefers-reduced-motion`)

## Blocked on / needs a decision
- none

## Next step
- Nothing outstanding — the demo is feature-complete. Optional future work: Supabase/realtime migration, the motion/a11y polish pass, and deleting the retained unused analytics components.
