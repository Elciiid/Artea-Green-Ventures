---
name: AGV Portal
description: Role-based environmental-compliance tracker for Artea Green Ventures
colors:
  forest-signal: "#2f7040"
  fogged-clearing: "#f1f3f1"
  morning-cloud: "#ffffff"
  forest-floor: "#1e2a1f"
  moss-ash: "#6b7264"
  canopy-contour: "#3f7652"
  trail-amber: "#8a5a17"
  deep-canopy: "#1b3a2b"
  canopy-cream: "#f0ede2"
  sage-mist: "#9db6a4"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
  body:
    fontFamily: "Inter, sans-serif"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    lineHeight: 1.35
    letterSpacing: "0.14em"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
  3xl: "1.375rem"
  4xl: "1.625rem"
components:
  button-primary:
    backgroundColor: "{colors.forest-signal}"
    textColor: "{colors.fogged-clearing}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.forest-signal}"
    textColor: "{colors.fogged-clearing}"
  card-directory:
    backgroundColor: "{colors.morning-cloud}"
    textColor: "{colors.forest-floor}"
    rounded: "{rounded.2xl}"
    padding: "0.875rem 1rem"
  badge-role:
    backgroundColor: "{colors.forest-signal}"
    textColor: "{colors.forest-signal}"
    rounded: "9999px"
    padding: "0.125rem 0.625rem"
---

# Design System: AGV Portal

## Overview

**Creative North Star: "The Canopy Registry"**

AGV Portal is an official record shot through with living green: the institutional trust of a compliance ledger, carried by a warm forest palette instead of enterprise gray. It is warm and approachable but still precise — human enough that staff and clients don't feel like they're fighting a government form, exact enough that nothing about role, access, or application status is ever ambiguous. The system explicitly avoids two failure modes: it should never read as a cold, gray enterprise dashboard, and it should never reach for bounce, gradients, or decorative flourish to manufacture warmth it hasn't earned structurally.

Depth is glass-first: frosted, translucent panels (`.glass`) floating over a soft green gradient wash are the system's primary depth cue, not drop shadows — shadows exist only as a quiet second layer underneath. Interaction feedback is tactile and confident: buttons press down a physical pixel on click, focus rings glow in the accent green, and directory cards pick up a signal-colored ring on hover — restrained, but never inert.

One fixed light identity — there is no dark mode, and no user-facing theme toggle exists. A single saturated accent (Forest Signal) carries almost all interactive emphasis; every other color is either neutral or role-coded (Trail Amber = in progress, Canopy Contour = resolved), never decorative.

**Key Characteristics:**
- Warm forest/cream palette standing in for an otherwise institutional compliance product
- Glass/frosted panels as the primary depth cue; shadows are a quiet second layer
- One accent color only — everything else is neutral or semantically role-coded
- Tactile press/focus feedback on every interactive control
- A single fixed light theme; no dark mode exists anywhere in the app

## Colors

A restrained, single-accent palette: one working green carries all interactive weight, everything else is a neutral ink/paper/moss scale or a semantically-assigned status color.

### Primary
- **Forest Signal** (`#2f7040`): the only saturated interactive accent — links, primary buttons, focus rings, selection highlight, checked states. Used sparingly and consistently; nothing else in the system competes with it for attention.

### Secondary
- **Canopy Contour** (`#3f7652`): resolved/positive status only (e.g. a completed compliance stage). Distinct from Forest Signal so "interactive" and "resolved" are never visually confused.
- **Trail Amber** (`#8a5a17`): active/in-progress status only (the pulsing stepper ring, in-flight application stages). Never used decoratively.

### Neutral
- **Fogged Clearing** (`#f1f3f1`): page background — a cool off-white, never pure white.
- **Morning Cloud** (`#ffffff`): panel and card surface, sitting one step lighter than the page background so cards read as distinct without a border.
- **Forest Floor** (`#1e2a1f`): primary text — a deep green-black ink, never pure black.
- **Moss Ash** (`#6b7264`): secondary text and borders. *Known drift: an unmerged branch (`review-fixes`) darkens this to `#686e61` to clear WCAG AA contrast — carry that value forward once merged, this file wasn't regenerated after the fix landed.*

### Named Rules
**The One Accent Rule.** Forest Signal is the only saturated color used for interactive emphasis anywhere in the system. A second bright accent is a regression, not a design choice.

**The No Second Theme Rule.** This is one fixed light identity, not "light mode" among several — there is no dark mode block and no user-facing theme toggle. Any `dark:`-prefixed utility a fetched component ships with is inert by construction; it must stay that way.

## Typography

**Display Font:** Outfit (with sans-serif fallback)
**Body Font:** Inter (with sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** Outfit's geometric warmth carries headlines and brand moments; Inter handles all body and UI text for maximum legibility; JetBrains Mono marks anything that reads as data — reference numbers, codes, and the small uppercase labels scattered through admin surfaces — signaling "this is a precise, referenceable fact," not just a stylistic accent.

### Hierarchy
- **Display** (Outfit): page and section headlines, hero copy.
- **Body** (Inter): all paragraph copy, form labels, navigation, and general UI text.
- **Label** (JetBrains Mono, 0.75rem, 1.35 line-height, 0.14em tracking, uppercase): role badges, section eyebrows, and other small referential tags. 0.75rem is a deliberate floor — nothing in the UI goes smaller.

### Named Rules
**The Label Floor Rule.** 0.75rem (Tailwind's `text-xs`) is the smallest type size anywhere in the system. It is the type scale's own minimum, not an arbitrary cutoff — nothing renders below it.

## Layout

Single-column, card-oriented layouts throughout; no dense multi-column data-grid aesthetic even on admin surfaces. Two shell modes exist: a normal `min-h-full`-based shell that grows with content and shows a natural scrollbar on long pages (e.g. the Applications Register), and a `boundedContent` shell (used by the People area) that pins header/nav/tabs and footer to the viewport and gives each tab its own internal `flex-1 min-h-0` scroll region so the footer is always reachable without a page-level scroll. Bounded pages use `py-6` section padding; normal pages use `py-12`. Directory/Access rows use `rounded-2xl` cards with `px-4 py-3.5` internal padding.

## Elevation & Depth

Glass-first, shadow-secondary: frosted translucency (`.glass` — 60% white background, 70% white border, paired with `backdrop-blur-xl`) is the primary way this system signals a floating or emphasized surface — the login card, the Home hero's card cluster, Directory/Access rows. Soft ambient shadows (`--shadow-panel`, `--shadow-pop`) exist as a quiet second layer, never the main depth signal. Glass only appears over the page's green gradient wash or photography — never over flat `Fogged Clearing`, where blur would be a visual no-op.

A separate fixed-dark glass variant (`.glass-dark`, deep-canopy-tinted with light `Canopy Cream` text) exists specifically for cards floating over imagery, so dark glass reads correctly regardless of the light page around it.

### Shadow Vocabulary
- **Panel** (`0 18px 44px -22px rgb(30 42 31 / 0.18)`): the default resting shadow under glass/elevated panels.
- **Pop** (`0 14px 34px -12px rgb(30 42 31 / 0.2)`): a slightly stronger lift, for elements that need to read as more prominently raised (e.g. an open dialog).

### Named Rules
**The Glass-Over-Texture Rule.** `.glass` is only ever used over the gradient wash or imagery, never over flat page background — glur against a flat color has no visual payoff and is a wasted effect.

## Shapes

Generously rounded throughout — `rounded-2xl` (18px) is the standard card/row corner, scaling from a `md` (8px) button/input radius up through `4xl` (26px) at the largest. Fully circular (`rounded-full`) shapes are reserved for avatars, the brand mark, and status/role badges (pill-shaped), which keeps "circle = identity or status," never a decorative accident.

## Components

### Buttons
- **Shape:** `rounded-md` (8px) at default size; `rounded-[min(var(--radius-md),8-10px)]` at smaller sizes.
- **Primary:** Forest Signal background, Fogged Clearing text; `hover:bg-primary/80` softens on hover rather than darkening.
- **Hover / Focus:** press feedback is physical — `active:translate-y-px` nudges the button down one pixel on click; focus-visible shows a 2px Forest Signal outline with offset, plus a `ring-3 ring-ring/50` glow. This is the system's signature "tactile and confident" feel — carry it into any new interactive control, not just buttons.
- **Secondary / Ghost / Outline:** secondary uses the card surface color with a subtle mix-in on hover; ghost and outline stay transparent until hovered, then pick up the muted background.
- **Destructive:** uses Trail Amber at low opacity (10–20%) rather than a separate red — this system has no red; "destructive" reads as the same amber used for "in progress," at a different opacity, not a new semantic color.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (18px).
- **Background:** `.glass` (translucent Morning Cloud over the gradient wash) for floating/emphasized surfaces; opaque Morning Cloud for plain content cards.
- **Shadow Strategy:** see Elevation & Depth — glass/translucency first, `shadow-panel` as a quiet second layer.
- **Hover:** directory/access rows pick up a `ring-1 ring-signal/40` on hover — a colored ring, not a shadow change or scale transform.
- **Internal Padding:** `px-4 py-3.5` on interactive rows.

### Badges (role / status)
- **Style:** `rounded-full` pill, thin border, uppercase Label typography (JetBrains Mono, 0.75rem, 0.14em tracking).
- **Color assignment:** role-coded, not decorative — e.g. admin/staff/client badges each get a fixed border/text pairing from the neutral or accent scale, never an arbitrary color per instance.

### Inputs / Fields
- **Style:** shadcn primitives (`Input`, `Textarea`, `Select`) bridged onto this palette — border uses Moss Ash, background uses the card surface, focus ring uses Forest Signal.
- **Focus:** same 2px Forest Signal outline + ring glow as buttons — one focus treatment system-wide, not a per-component variant.

### Navigation
- Desktop: horizontal pill-style nav in the header. Mobile: a shadcn `Sheet` drawer, replacing an earlier hand-rolled focus-trap implementation.
- Account menu is a shadcn `DropdownMenu`; active/current section is indicated by accent color, not weight or underline changes.

## Do's and Don'ts

### Do:
- **Do** use Forest Signal as the only saturated interactive accent — new components should reach for it before any other color.
- **Do** treat glass/translucency as the default way to elevate a floating panel; reach for `shadow-panel`/`shadow-pop` as a secondary reinforcement, not the primary signal.
- **Do** give every interactive control the same press (`translate-y-px`) and focus-visible (2px Forest Signal outline + ring glow) treatment already standard on buttons and inputs.
- **Do** keep role/status color-coding semantic: Forest Signal = interactive, Canopy Contour = resolved, Trail Amber = in-progress/destructive. One meaning per color.

### Don't:
- **Don't** introduce a second saturated accent color or a dedicated "red" for destructive actions — this system deliberately reuses Trail Amber at different opacities instead.
- **Don't** add a dark mode or any user-facing theme toggle — this is one fixed light identity by explicit prior decision (Phase 19 removed the previous toggle).
- **Don't** apply `.glass` over flat page background — it only belongs over the gradient wash or imagery.
- **Don't** reach for bounce/elastic easing or gradient-heavy decoration to manufacture warmth — the palette and glass panels already carry the warmth; motion should stay purposeful and restrained (respecting `prefers-reduced-motion` everywhere, as the codebase already does).
