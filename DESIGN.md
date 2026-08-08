---
name: AGV Portal
description: Role-based environmental-compliance tracker for Artea Green Ventures
colors:
  void: "#fcfbf8"
  pine: "#ffffff"
  bone: "#141d16"
  ash: "#616c63"
  signal: "#2f6a3f"
  signal-deep: "#13331d"
  signal-light: "#81b482"
  contour: "#2f6a3f"
  amber: "#8a6a1e"
  destructive: "#e7000b"
  rail: "#08120c"
  rail-ink: "#f4f6f0"
  rail-muted: "#9db6a4"
  border: "#dae0d9"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
  body:
    fontFamily: "Outfit, sans-serif"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    lineHeight: 1.35
    letterSpacing: "0.22em"
rounded:
  base: "0.25rem"
  sm: "0.15rem"
  md: "0.2rem"
  lg: "0.25rem"
  xl: "0.35rem"
  2xl: "0.45rem"
  3xl: "0.55rem"
  4xl: "0.65rem"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.void}"
    rounded: "9999px"
    padding: "0 1.25rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.void}"
  card-panel:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "1.5rem"
  badge-role:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    rounded: "9999px"
    padding: "0.125rem 0.625rem"
---

# Design System: AGV Portal

## Overview

**Creative North Star: "The Canopy Registry"**

AGV Portal is an official record shot through with living green: the institutional trust of a compliance ledger, carried by a warm forest palette instead of enterprise gray. It is precise and document-like — every card is a flat, bordered surface with a clear edge, never a hazy or floating one — while staying warm through color and typography rather than through texture or blur. The system explicitly avoids two failure modes: it should never read as a cold, gray enterprise dashboard, and it should never reach for bounce, gradients, or decorative flourish to manufacture warmth it hasn't earned structurally.

**This file replaces an earlier "glass-first, 3-typeface" identity that no longer describes the app.** The product went through a full reskin (2026-08-07/08, against the user's own reference repo `artea-green-glow`) that deliberately reversed both of those calls: depth is now flat-bordered, not frosted, and typography is Outfit-only, not a Display/Body/Label three-font system. This rewrite reconciles the doc against the actual current `globals.css` and components rather than patching the two known-stale lines — see the Elevation, Typography, and Shapes sections below for exactly what changed and why.

Depth is flat-first: bordered cards on a plain page background (`--color-void`) are the system's primary and near-universal depth cue, with a soft ambient shadow (`--shadow-panel`) as a quiet second layer. There is exactly **one** deliberate frosted-glass surface left in the whole app — the signed-in header bar — kept translucent by direct user request as a scoped exception, not a return to the old glass-first language; see Elevation & Depth below.

One fixed light identity — there is no dark mode, and no user-facing theme toggle exists. A single saturated accent (Forest Signal) carries almost all interactive emphasis; status is either neutral, active (amber), or resolved (the same green family as the accent) — plus one genuine destructive red for irreversible actions, which the previous version of this doc said didn't exist. It does now; see Colors.

**Key Characteristics:**
- Warm forest/cream palette standing in for an otherwise institutional compliance product
- Flat, bordered cards as the default surface everywhere except one deliberate frosted header
- Outfit for every typographic role — no separate body/label typeface
- One accent color for interactive emphasis, one real destructive red, everything else neutral or status-coded
- A single fixed light theme; no dark mode exists anywhere in the app

## Colors

A restrained, mostly single-accent palette: one working green carries interactive weight, a near-black "rail" tone carries the one dark surface in the app (the signed-in header and the Home hero), and everything else is neutral or status-coded.

### Primary
- **Signal** (`#2f6a3f`): the only saturated interactive accent — links, primary buttons, focus rings, selection highlight, checked states, active nav. Used sparingly and consistently; nothing else in the system competes with it for attention.
- **Signal Deep** (`#13331d`) / **Signal Light** (`#81b482`): darker/lighter steps of the same accent, used in the Home hero's dark gradient overlay and light-on-dark text respectively — not general-purpose UI tones.

### Secondary
- **Contour** (`#2f6a3f`): resolved/positive status. **Currently identical to Signal** — both are literally the same hex today, unlike the previous version of this doc which described them as visually distinct. Kept as a separate token name for semantic clarity in code (`text-contour` reads as "resolved," `text-signal` reads as "interactive"), but a reader should not expect a visible color difference between the two right now.
- **Amber** (`#8a6a1e`): active/in-progress status only (the pulsing stepper ring, in-flight application stages). Never used decoratively.
- **Destructive** (`#e7000b`): a real, dedicated red — added during the reskin for delete/revoke hover states (e.g. removing a roster member, deleting a company). This supersedes the previous version of this doc's "no dedicated red, reuse amber" rule for destructive actions specifically; amber still means in-progress/active status, never destructive.

### Neutral
- **Void** (`#fcfbf8`): page background — a warm off-white, never pure white.
- **Pine** (`#ffffff`): panel/card surface — pure white, one step lighter than the page so cards read as distinct even with a border doing most of the separation work.
- **Bone** (`#141d16`): primary text — a deep green-black ink, never pure black.
- **Ash** (`#616c63`): secondary text and borders (`border-ash/20`, `border-ash/15`, etc. at varying opacities is the standard way this system draws a card edge).
- **Border** (`#dae0d9`): the shadcn/Kokonut bridge token for input/generic component borders — a very light sage-tinted gray, distinct from `ash` (which is what most hand-styled panels use directly).

### Dark surface
- **Rail** (`#08120c`): a near-black (not forest green, despite the name suggesting otherwise) used for exactly two surfaces — the Home landing hero and the signed-in app's header/mobile dock. This is new since the reskin; the previous identity had no dedicated dark surface at all.
- **Rail Ink** (`#f4f6f0`) / **Rail Muted** (`#9db6a4`): light text/muted-text tones used on top of Rail.

### Named Rules
**The One Accent Rule.** Signal is the only saturated color used for non-destructive interactive emphasis anywhere in the system. A second bright accent (other than the dedicated Destructive red) is a regression, not a design choice.

**The No Second Theme Rule.** This is one fixed light identity, not "light mode" among several — there is no dark mode block and no user-facing theme toggle. Any `dark:`-prefixed utility a fetched component ships with is inert by construction; it must stay that way.

## Typography

**Everything: Outfit** (with system sans-serif fallback). `--font-display` and `--font-sans` both point at the same Outfit variable — this is a genuine identity change from the previous three-typeface system (Outfit/Inter/JetBrains Mono), not a naming cleanup. Inter and JetBrains Mono webfonts were dropped entirely during the reskin.

**Character:** Outfit's geometric warmth now carries everything — headlines, body copy, form labels, and navigation alike — rather than being reserved for headlines against a more neutral body face. The uppercase "eyebrow" labels scattered through admin surfaces (section titles, role badges) still read as distinct data-like tags, but that distinction now comes from size/tracking/case (see the Label rule below), not from a separate monospace typeface.

`--font-mono` still exists as a token and is still used in specific, narrow spots — reference numbers (`AGV-2026-0118`), audit-log detail text — but it resolves to the system's own monospace stack (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`), not a custom webfont. There is no JetBrains Mono anywhere in the app anymore.

### Hierarchy
- **Headlines** (Outfit, bold, tight tracking): page titles (`text-4xl sm:text-5xl font-bold tracking-tight`) and the Home landing's larger display sizes.
- **Body** (Outfit, regular/light weights): all paragraph copy, form labels, navigation, and general UI text.
- **Eyebrow / Label** (the `eyebrow` CSS utility — 0.75rem, 600 weight, 0.22em tracking, uppercase): section labels above headlines, role/status badges. Still Outfit, not a separate typeface — the distinction from body text is entirely size/weight/tracking/case now.
- **Mono** (system monospace, narrow use only): reference codes and audit-log technical detail — not a general "data" typeface used broadly the way the old Label tier was.

### Named Rules
**The Label Floor Rule.** 0.75rem (Tailwind's `text-xs`, matching `--text-label`) is the smallest type size anywhere in the system. It is the type scale's own minimum, not an arbitrary cutoff — nothing renders below it. Still true, unchanged by the reskin.

## Layout

Single-column, card-oriented layouts throughout; no dense multi-column data-grid aesthetic even on admin surfaces (tables are the one exception — Applications Register, Access matrices — and those get an explicit `overflow-x-auto` escape hatch rather than trying to force a grid). Two shell modes exist: a normal `min-h-full`-based shell that grows with content and shows a natural page scrollbar on long pages (e.g. Applications), and a `boundedContent` shell (People, Companies, My Team) that pins header/nav/footer to the viewport and gives the page's own content region a `flex-1 min-h-0` internal scroll, so the footer stays reachable without a page-level scroll. Both kinds of page now share the same top offset (`pt-12`) so navigating between them doesn't visibly shift the header — bounded pages only trim their *bottom* padding (`pb-6` vs `pb-12`), a fix made after the two page types were found sitting at different heights.

`scrollbar-gutter: stable` is set globally on `html` for the same reason: without it, navigating from a page that doesn't need a scrollbar to one that does shifts the centered header sideways as the browser's scrollbar column appears/disappears.

## Elevation & Depth

**Flat-first, shadow-secondary — the reverse of the previous "glass-first" identity.** Bordered cards (`rounded-sm border border-ash/20 bg-pine`) on the plain `void` page background are the default and near-universal surface everywhere in the app: Companies, People, Dashboards, Login/Signup, Account settings, dialogs. A soft ambient shadow (`--shadow-panel`) sits underneath as a quiet second layer, the same supporting role it always had — what changed is that translucency/blur is no longer the *primary* signal above it.

The `.glass` CSS class itself still exists and is still referenced by classNames in a handful of not-yet-migrated files (mostly `SurfaceState`'s loading/error/empty wrapper, e.g. `className="glass ... backdrop-blur-xl"`), but the class was redefined during the reskin to a flat bordered card with `backdrop-filter: none !important` — so those call sites already render identically to a plain flat card today; the `.glass`/`backdrop-blur-xl` classNames on them are inert leftovers, not a second visual language still in effect. `.glass-dark` (a genuinely translucent dark variant, for cards over imagery) still exists in `globals.css` too, but has no remaining call sites anywhere in the app — fully dead CSS, flagged here rather than silently left undocumented.

**One deliberate, real exception exists:** the signed-in app's header bar (`AppShell.tsx`) is genuinely translucent — `bg-void/60` + `backdrop-blur-xl` + `shadow-panel` — per a direct, explicit request to have that one surface read as frosted glass. This is a scoped, page-specific choice, not a reversion to glass-first depth; every other surface in the app stays flat. If a future change wants glass anywhere else, treat that as a new decision to make deliberately, not an assumption that the old identity is coming back.

### Shadow Vocabulary
- **Panel** (`0 1px 2px rgb(20 40 25 / 0.04)`): the default resting shadow under flat cards — much subtler than the previous identity's glass-supporting shadow, appropriate for a flat surface that doesn't need much help reading as "raised."
- **Pop** (`0 8px 20px -8px rgb(20 40 25 / 0.12)`): a stronger lift for elements that need to read as more prominently raised — currently used by the mobile icon dock.

### Named Rules
**The One Frosted Surface Rule.** Exactly one surface in the app is deliberately translucent: the signed-in header. Nowhere else should reach for `backdrop-blur-*` as a real depth effect — the inert `.glass`/`backdrop-blur-xl` classNames still present on a few `SurfaceState` wrappers are leftover, not precedent; new work should use a plain flat card, and migrating those leftovers to say so explicitly is a reasonable small cleanup, not a design decision.

## Shapes

**Tight and flat**, the opposite of the previous "generously rounded" identity — `--radius` dropped from `0.625rem` to `0.25rem` during the reskin, and every `rounded-*` utility across the app is derived from that one base value via a fixed multiplier chain (`sm` = 0.6×, `md` = 0.8×, `lg` = 1×, `xl` = 1.4×, `2xl` = 1.8×, `3xl` = 2.2×, `4xl` = 2.6×). In practice this means:
- **`rounded-sm`** (≈2.4px) is now the standard card/panel corner — replacing the previous system's much larger `rounded-2xl` (18px) as the default.
- **`rounded-full`** is still reserved for avatars, the brand mark, buttons, and status/role/pill badges — unchanged from before; "circle/pill = identity, status, or action," never a decorative accident.
- Inputs and smaller controls sit around `rounded-md`/`rounded-lg` (≈3–4px) — tight, not the previous system's 8px.

## Components

### Buttons
- **Shape:** `rounded-full` for primary CTAs and most standalone buttons throughout the app (Sign In, New company, Save, Update password) — a change from the previous system's `rounded-md` default. The shared shadcn `Button` primitive's own base radius is `rounded-md`, but nearly every real call site overrides it to `rounded-full` via className, which is now the de facto standard for a standalone action button.
- **Primary:** Signal background, Void text.
- **Hover / Focus:** press feedback is physical — `active:translate-y-px` nudges the button down one pixel on click; focus-visible shows a 2px Signal outline with offset plus a ring glow. Unchanged from before — still the system's signature tactile feel, and still expected on any new interactive control.
- **Secondary / Outline:** transparent/void-tinted background with an ash border, filling in on hover.
- **Destructive:** now a real red (`text-destructive`, `hover:text-destructive`) on plain text-style "Remove"/"Delete" actions, e.g. removing a roster member or deleting a company — not amber-at-low-opacity anymore.

### Cards / Containers
- **Corner Style:** `rounded-sm` (≈2.4px) — the biggest visible shift from the previous identity's `rounded-2xl`.
- **Background:** flat `bg-pine` with a `border border-ash/20` doing most of the separation work, plus `shadow-panel` underneath. No translucency (see Elevation & Depth).
- **Internal Padding:** `p-6`/`p-7` on panel-level cards (`HomePanel`, admin section panels); tighter (`px-4 py-3`-ish) on interactive list rows.
- **Stat tiles:** a distinct, simpler card variant (`StatTile` — eyebrow label, large bold value, optional light note) used on Dashboard surfaces that have a genuine headline number worth that visual weight, not applied to every card generically.

### Tables
- Real `<table>`-based grant/scope matrices (Applications Register, Access tab's Staff/Company tables) — replaced several earlier expandable-row/card patterns during the reskin. Wrapped in `overflow-x-auto` since a matrix can outgrow the viewport horizontally at scale; this is an accepted, flagged trade-off, not an oversight.

### Badges (role / status)
- **Style:** `rounded-full` pill, thin border, small uppercase eyebrow-style text (no longer a distinct monospace typeface — see Typography).
- **Color assignment:** still role/status-coded, not decorative — Signal for the active/selected role pill, Amber for in-progress status, Contour/Signal for resolved, Ash for neutral/inactive.

### Inputs / Fields
- **Style:** shadcn `Input`/`Label` primitives, generally overridden per call site to `border-ash/20 bg-void/40` or similar rather than the primitive's own default border/background tokens — the app's own palette wins over the shadcn bridge tokens almost everywhere real forms appear.
- **Focus:** same Signal-colored focus-visible treatment as buttons.

### Navigation
- **Desktop:** horizontal pill-style nav in the header — unchanged from before.
- **Mobile:** a fixed, floating icon **dock** (`AppShell.tsx`'s `Dock` component) with hover tooltips showing each icon's label — **this replaced the previous shadcn `Sheet`-based hamburger drawer entirely** during the reskin; there is no slide-out drawer anywhere in the app anymore.
- Account menu is still a shadcn `DropdownMenu`; it now sizes to its content (`w-auto min-w-48`) rather than a fixed width, and the role badge sits inline with the name rather than stacked underneath it.

## Do's and Don'ts

### Do:
- **Do** use Signal as the only saturated non-destructive interactive accent — new components should reach for it before any other color.
- **Do** default every new card/panel to a flat bordered surface (`rounded-sm border border-ash/20 bg-pine shadow-panel`) — this is the system's actual default now, not glass.
- **Do** give every interactive control the same press (`translate-y-px`) and focus-visible (2px Signal outline + ring glow) treatment already standard on buttons and inputs.
- **Do** use the real Destructive red for irreversible actions (delete, remove) — amber is for in-progress status only, not destructive actions, since the reskin.
- **Do** use `rounded-full` for buttons, pills, and badges, and `rounded-sm` for everything else that needs a corner.

### Don't:
- **Don't** introduce a second saturated accent color beyond Signal and the one dedicated Destructive red.
- **Don't** add a dark mode or any user-facing theme toggle — this is one fixed light identity by explicit prior decision.
- **Don't** reach for `backdrop-blur-*`/translucency as a general depth effect — the signed-in header is the one deliberate exception, not a precedent. New floating/emphasized surfaces should be flat, not glass.
- **Don't** reach for `rounded-2xl`/`rounded-3xl` as a default card radius — that was the previous identity; `rounded-sm` is correct now.
- **Don't** reach for bounce/elastic easing or gradient-heavy decoration to manufacture warmth — the palette and typography already carry it; motion should stay purposeful and restrained (respecting `prefers-reduced-motion` everywhere, as the codebase already does).
