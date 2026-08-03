# Front-end Review — AGV Portal

**Reviewed:** 2026-07-31 · working tree clean, branch `main`, all findings against committed code.
**Scope:** static review of `src/` (76 `.ts`/`.tsx` files), `globals.css`, `package.json`, `eslint.config.mjs`, `next.config.ts`, and the RLS policies the front end depends on. No dev server, no browser.
**Relationship to `STATUS.md`:** the `cn()`/tailwind-merge hazard family, the Select accname regression, the concatenated-fallback accname bugs, the Motion/`position:sticky` bug, the orphaned `auth.users` row, and the `Tabs` `orientation` quirk are all treated as closed and are not re-litigated here. `HomeShell.tsx` appears once in the consolidated dead-code list only.

Contrast numbers below are computed from the real hex values in `globals.css` `@theme` using the WCAG 2.x relative-luminance formula, not eyeballed.

---

## If you can only act on 5 things

1. **`--color-ash` fails WCAG AA against the page background — 4.47:1, needs 4.5:1** (`globals.css:30`). It is the app's single most-used secondary text colour and it fails on *every* surface that isn't a `.glass` panel: the footer, both nav bars, the People tab bar, Directory's group headings, every loading/empty message, the Home hero body copy. One token change (`#6b7264` → `#686e61`, computed to 4.72:1) fixes ~40 call sites at once. Cheapest high-value fix in the report.
2. **`revokeAccess()` is an RLS-gated UPDATE with no row-returned check** (`src/lib/supabase/access.ts:77-84`), in direct violation of the rule this repo wrote its own helper for (`src/lib/supabase/assert-write.ts:1-8`). A permission gap here doesn't error — the checkbox silently flips back with no message. It is the only unguarded write left in the codebase.
3. **The three People surfaces have three different, partly-broken error/loading/empty contracts** (§1, §5). Access ships a literal `No one matches "".` when the list is genuinely empty (`AccessMatrix.tsx:161-163`); the admin register has *no* empty state at all (`AdminDashboard.tsx:62-70`); Activity silently swallows a failed profile fetch and renders raw UUIDs (`ActivityLog.tsx:54`); none of the three marks errors with `role="alert"`. This is the "rebuilt separately across passes" tax and it is the most user-visible cluster.
4. **`RoleChangeDialog` never pre-selects the person's current role** (`RoleChangeDialog.tsx:41-46`) — the `setPendingRole(person.role)` line is unreachable because the dialog is opened by prop, not by a `DialogTrigger`, and Radix only fires `onOpenChange` for *internal* state requests. Compounding it, a failed save wipes the user's selection (`:55`). A one-line `useEffect` fixes both.
5. **No tests, and the lint config is missing `eslint-plugin-react-hooks`** (`eslint.config.mjs:10-38`, `package.json:5-9`). The missing plugin is already costing you: `AppShell.tsx:102` rebuilds `allowedRoles` every render and feeds it to a `useEffect` dep array (`:111`), so the route-guard effect re-runs on every render. Add the plugin first (10 minutes, catches a real live defect), then the one integration test argued for in §8.

---

## 1. Architecture & code organization

### Should fix

**1.1 — Directory / Access / Activity implement the same four concerns four different ways.** They sit in the same folder, render inside the same layout, and share `SimplePagination`, but nothing else is shared. Side by side:

| Concern | `PersonDirectory.tsx` | `AccessMatrix.tsx` | `ActivityLog.tsx` | `AdminDashboard` / `UserPortalView` |
|---|---|---|---|---|
| Fetch | named `load()`, no cancel guard (`:35-50`) | `Promise.all` + `let cancelled` + cleanup (`:52-70`) | three bare `.then()` chains, no guard (`:41-55`) | `let cancelled` + cleanup |
| Loading UI | bare `<p role="status">Loading…</p>` (`:78`) | glass panel + spinner + `aria-live` (`:132-138`) | bare `<p role="status">Loading…</p>` ×2 (`:103`,`:136`) | `<RegisterStatus kind="loading">` |
| Error UI | bare `<p class="text-amber">` (`:82`) | glass panel + `<h2>` + message (`:139-145`) | bare `<p class="text-amber">` ×2 (`:105`,`:138`) | `<RegisterStatus kind="error">`, `text-ash` not `text-amber` |
| Write feedback | `toast.success` + `toast.error` (`:56`,`:60`) | `toast.error` only, no success toast (`:91`) | n/a (read-only) | n/a |
| Scroll region | scrolls the *whole* surface incl. heading (`:69`) | pins heading `shrink-0`, scrolls only the list (`:125`,`:159`) | pins heading, scrolls per-tab (`:83`,`:101`) | page-level |

Four loading treatments, four error treatments, three fetch idioms, two scroll models. The fix isn't a mega-refactor — it's one `useAsyncResource<T>()` hook plus a `<SurfaceState loading error empty>` component, which would collapse roughly 120 lines across the three files and make the remaining §5 bugs structurally impossible.

**1.2 — Two live application data layers, one of which is dead.** `src/lib/applications.ts` is a Zustand `persist` store seeding the full `APPLICATIONS` mock array into `localStorage`. Every real read now goes through `src/lib/supabase/applications.ts`. Grep confirms the *only* surviving consumer of the store is `AppShell.tsx:97` (`resetDemo`), meaning the account-menu item **"Reset demo data"** (`AppShell.tsx:239-247`) resets a store nothing reads — it is a visible, admin-facing no-op. `PortalUser`, `visibleApplicationsFor()`, `isApplicationVisible()`, `setStage`, `addNote`, `toggleVisibility` (`applications.ts:18-140`) are all unreferenced.

### Worth knowing, not urgent

**1.3 — `src/app/admin/people/layout.tsx:24-29`'s comment describes a component that no longer exists** ("Access's *table*… Roles' compact form never needs to scroll"). Access has no table and Roles is a redirect stub. Minor, but this comment is the only in-repo explanation of the bounded-shell contract, so it's the first thing the next person reads and it's wrong.

**1.4 — Three redirect stubs point at one route** (`admin/access/page.tsx`, `admin/people/page.tsx`, `admin/people/roles/page.tsx`) all `redirect("/admin/people/directory")`. Fine as-is; worth a dated note on when the legacy two can be dropped.

**1.5 — `src/` organization is still coherent.** `components/admin/` vs `components/home/` vs `components/ui/` vs `lib/supabase/` reads cleanly. The only oddity is that `components/home/` now holds exactly one live file (`HomeLanding.tsx`) plus one dead one, so the directory earns its own existence only barely.

---

## 2. Type safety & data layer

### Worth knowing, not urgent

**2.1 — Supabase types are hand-written, and there is no generated `database.types.ts`.** Confirmed: no such file anywhere in the repo. Every row shape is declared by hand and cast — `roles.ts:15-19` + `:28` (`as ProfileForRoleAssignment[]`), `access.ts:10-26` + `:37`/`:53`/`:64`, `auditLog.ts`, `loginActivity.ts`, and `session.ts:83-88` + `:119` (`as ProfileRow | null`). These casts are unchecked assertions: if a migration renames a column, `tsc` stays green and the UI renders `undefined`. `supabase gen types typescript` into a committed `database.types.ts` would make all seven of those casts real.

**2.2 — `any` is genuinely absent.** Grep for `: any`, `as any`, `<any>`, `any[]` across `src/` returns two hits, both the English word "any" inside comments. Likewise zero `@ts-ignore`/`@ts-expect-error`. This is better than most codebases of this size and worth saying plainly. **Correction (2026-08-03):** the "zero `eslint-disable`" half of this claim is now stale — `src/lib/useAsyncResource.ts:56` has one (`react-hooks/exhaustive-deps`), added on the `review-fixes` branch and well-justified/documented inline: `fetcher`/`fallbackMessage` are deliberately excluded from the dependency array (an inline arrow-function fetcher would otherwise force a re-fetch on every render), which the lint rule can't statically verify is safe. Not a regression in code quality, just a claim this document can no longer make.

**2.3 — RLS assumptions do *not* leak badly, with one exception.** The pattern is correct almost everywhere: `AdminDashboard.tsx:5-6` and `UserPortalView.tsx:6-8` both explicitly document that they do *no* client-side filtering because RLS already scopes the rows, and neither does. `fetchGrantableProfiles()` (`access.ts:29-38`) filters admins out with `.in("role", ["staff","client"])` at the *query*, not in JSX. `AppShell`'s `expect` guard (`:104-111`) is a redirect for UX, with the server-side check living in `api/admin/set-role/route.ts:61-75` — which correctly re-derives the caller's role server-side rather than trusting the client.

The exception: **`api/admin/set-role/route.ts` lets an admin demote themselves.** There is no `profileId === user.id` guard, `fetchAllProfiles()` (`roles.ts:21-29`) returns the signed-in admin's own card, and `RoleChangeDialog` will happily offer "client". The `agv_prevent_self_role_escalation` trigger only blocks *escalation*, and the route writes with the service-role client which the file's own header (`:11-13`) notes bypasses that trigger anyway. A sole admin who does this locks the whole org out of `/admin` with no UI path back. Cheap fix: reject `profileId === user.id` in the route (server-side, not just hidden in the UI).

---

## 3. Accessibility

### Should fix

**3.1 — `--color-ash` on the page background fails AA.** Computed from `globals.css:27-30`:

| Pair | Ratio | AA normal (4.5) |
|---|---|---|
| `ash #6b7264` on `void #f1f3f1` | **4.47:1** | ✗ fail |
| `ash` on `.glass` (white 60% over void ≈ `#f9faf9`) | 4.77:1 | ✓ pass |
| `bone #1e2a1f` on `void` | 13.40:1 | ✓ |
| `signal #2f7040` on `void` | 5.36:1 | ✓ |
| `amber #8a5a17` on `void` | 5.31:1 | ✓ |
| `contour #3f7652` on `void` | 4.80:1 | ✓ |
| `rail-ink #f0ede2` on `rail #1b3a2b` | 10.62:1 | ✓ |
| `rail-muted #9db6a4` on `rail` | 5.73:1 | ✓ |

So the palette is well-built *except* `ash`, which misses by 0.7%. Because `.glass` lifts the background, whether a given `text-ash` passes depends entirely on whether it happens to sit inside a panel. Failing sites on bare background: `AppShell.tsx:278`,`:282` (footer), `AppShell.tsx:317-322` (inactive `PillLink`), `PeopleTabNav.tsx:24` (inactive tabs), `PersonDirectory.tsx:113`,`:117`,`:78`,`:82`, `AccessMatrix.tsx:269` and its `PeopleSectionHeading`, `SimplePagination.tsx:27` as used by Access, `HomeLanding.tsx:52`,`:69`,`:77`, `ApplicationRegister.tsx:94`,`:180`.

Computed fix: `--color-ash: #686e61` → 4.72:1 on `void`, 5.04:1 on `.glass`. Visually indistinguishable as a border/divider colour, and it clears every site in one edit.

**3.2 — Non-text contrast (WCAG 1.4.11, 3:1) fails on the controls that most need it.**
- `AccessMatrix.tsx:238-242` — the unchecked access checkbox's only visual affordance is `border-ash/30`. Composited over `.glass`, that's **≈1.45:1**. An unchecked checkbox is, for practical purposes, invisible as a control.
- `AccessMatrix.tsx:155` — the filter `Input`'s `border-ash/25` over the page background is **≈1.36:1**. The border is the only thing marking it as a text field.
- `PeopleSectionHeading.tsx:33` — `text-ash/70` on the info-icon button computes to **2.63:1** on `void`. It is an icon-only control, so 3:1 applies to the glyph itself.

The checked state is fine (`border-signal bg-signal`, 5.36:1). It's specifically the *empty/idle* states that disappear.

**3.3 — Heading hierarchy is broken on two of the three People tabs.** `PeopleSectionHeading` renders the section name as a `<span>` (`:25`), not a heading. Result:
- `/admin/people/directory` — `h1` "People" → `h2` "Admin & staff", `h2` "Clients". The *section* name ("Directory") is unheaded; the h2s name the groups.
- `/admin/people/access` — `h1` "People" and **nothing else**. An `<h2>` exists only in the error branch (`AccessMatrix.tsx:141-143`), so the outline changes shape depending on whether the fetch failed.
- `/admin/people/activity` — `h1` "People" and **nothing else**. `<section aria-label="Activity log">` (`:80`) names the landmark but contributes no heading.

Heading-based navigation, the primary way screen-reader users skim a page, dead-ends immediately on 2 of 3 tabs. Changing the `<span>` to an `<h2>` inside `PeopleSectionHeading` fixes all three at once, and Directory's group titles should drop to `<h3>`.

**3.4 — Error states in the People surfaces are not announced.** `PersonDirectory.tsx:82`, `AccessMatrix.tsx:139-145`, `ActivityLog.tsx:105`/`:138` all render failures as a plain `<p>`. In each case the loading node carrying `role="status"` is *replaced* by the error node, so the live region is removed rather than updated and nothing is announced — a screen-reader user is left on "Loading…" forever. The auth/account forms get this right (`page.tsx:155`, `signup/page.tsx:229`, `AccountSettings.tsx:155`,`:410`,`:436` all use `role="alert"`); the admin surfaces were never brought up to that bar.

**3.5 — `RoleChangeDialog` closing loses focus.** `PersonDirectory.handleRoleChange` (`:52-62`) calls `setEditing(null)` and then `await load()`, whose first statement is `setState({status:"loading"})` (`:37`). Both are in the same microtask continuation, so React 19 batches them into a single render: the dialog unmounts *and* the entire card list is replaced by the "Loading…" paragraph simultaneously. Radix's `FocusScope` restores focus to the previously-focused element on unmount — but that element (the person card button) no longer exists, so focus falls to `<body>` and keyboard position is lost. Reordering to `await load()` *then* `setEditing(null)` would keep the card mounted for the restore. Worth a live confirmation, but the mechanism is unambiguous from the code.

**3.6 — `SimplePagination` drops focus at the ends of the range.** `:33-47` — clicking "Next" onto the last page sets `disabled` on the button you just activated; browsers blur a newly-disabled element, so focus lands on `<body>` and keyboard users have to re-tab in. Same for "Previous" on page 1. Standard fix: keep both buttons enabled and no-op / use `aria-disabled` instead. `:24` also unmounts the whole control (including its `aria-live` region) when `totalPages <= 1`, so filtering down to one page silently removes the announcer.

**3.7 — The "at least 8 characters" hint is orphaned from its field.** `AccountSettings.tsx:498` renders `hint` as a sibling `<p>` with no `id`/`aria-describedby` link to the `<Input>` at `:487`. A screen-reader user hears "New password, edit text" and never learns the constraint until the form rejects them.

### Worth knowing, not urgent

**3.8 — Accessible names are otherwise in good shape.** Every icon-only control has an explicit name: the hamburger (`AppShell.tsx:178`), the account avatar (`:222`), the info-icon (`PeopleSectionHeading.tsx:32`), each Directory card (`PersonDirectory.tsx:125`), each Access row (`AccessMatrix.tsx:178`), each access checkbox (`:235`), both pagination buttons (`SimplePagination.tsx:36`,`:46`). Form labels are complete: login (`page.tsx:120`,`:137`), signup (four, `:161`–`:212`), account (`Field` at `:481`, MFA code at `:387`), the role radio group uses a proper `<fieldset>`+`sr-only <legend>` (`RoleChangeDialog.tsx:72-73`), and `ApplicationDetail.tsx:191-206` uses a wrapping `<label>` on its native `<select>`. The filter input is `aria-label`-only (`AccessMatrix.tsx:154`) — acceptable, though a visible label would survive the placeholder disappearing on type.

**3.9 — Collapsible wiring is correct.** `CollapsibleTrigger asChild` over a real `<button>` (`AccessMatrix.tsx:175-176`) means Radix supplies `aria-expanded`, `aria-controls` and `data-state`, and `CollapsibleContent` is `hidden` when closed so its checkboxes leave the a11y tree. The one oddity is `aria-live="polite"` on the count chip (`:195`) *inside* a button whose `aria-label` (`:178`) already states the same count — the chip will announce on toggle, but the duplication is redundant rather than harmful.

**3.10 — On the still-open "floating element detached from trigger" bug class:** every Radix floating primitive in the current code renders inside a Portal — `tooltip.tsx:40`, `dialog.tsx:59`, `dropdown-menu.tsx:41`, `sheet.tsx:59`, and the (unused) `select.tsx:68`. Because they portal to `document.body`, none of them has the app's many `backdrop-filter` elements (`.glass … backdrop-blur-xl`, 14 sites) in its ancestor chain, and `backdrop-filter` is precisely what creates a containing block for `position:fixed` descendants and produces that symptom. Collapsible is normal-flow and can't hit it at all. So: no *current* element is exposed. The concrete guard-rail is "never render a Radix `*Content` outside its `*Portal`" — worth a comment in `components.json`-adjacent docs, since re-adding a primitive via the CLI is the realistic path back into this.

---

## 4. Performance

### Should fix

**4.1 — Every access toggle refetches the entire grants table.** `AccessMatrix.handleToggle` (`:88`) calls `fetchLiveGrants()` — which selects *all* live grants across *all* profiles and *all* applications (`access.ts:57-65`) — after each individual checkbox click. Ticking five boxes on one person = five full-table round-trips, and there's no optimistic update, so each checkbox stays visually unchanged for the full round-trip (only `disabled:opacity-50` at `:238` hints anything is happening). Either patch the single grant into state locally, or scope the refetch to the one profile.

**4.2 — Motion is imported on the two routes that most need a fast first paint.** `motion/react` is imported in exactly four files (`page.tsx:15`, `signup/page.tsx:22`, `ApplicationDetail.tsx:16`, `TopoField.tsx:15`). On login and signup it powers a single `{opacity:0,y:26}` → `{opacity:1,y:0}` entrance (`page.tsx:100-103`) — a plain CSS keyframe, which this app already writes elsewhere (`globals.css:148-162`). Login is the unauthenticated entry point and the one route where bundle weight is fully user-visible. `ApplicationDetail`/`TopoField` genuinely use `AnimatePresence` and animated width, so keep it there.

### Worth knowing, not urgent

**4.3 — `"use client"` on 33 of 76 files, and the server/client boundary is largely defaulted away.** The client boundary is drawn at `AppShell`, which every signed-in surface wraps — so `/home`, `/admin`, `/portal`, `/account` and all three People tabs are client-rendered in their entirety, with all data fetched from the browser via the anon key. That's a defensible architecture for an RLS-first app (RLS is enforced identically either way, and the auth session lives in a Zustand store), but it means Next 16's server components are contributing essentially nothing beyond routing and metadata. The genuinely-avoidable ones are small: `PeopleTabNav.tsx` (client only for `usePathname()` — could be a server component if the layout passed the segment), and the `page.tsx` files are already correctly server components. Not worth reworking now; worth naming as a deliberate choice rather than an accident, because it's the reason every list flashes a spinner before content.

**4.4 — `.glass backdrop-blur-xl` is applied 14 times, largely against the design system's own advice.** `globals.css:61-67` states the rule: *"use over photography or gradients, not over plain body background (redundant blur there, no visual payoff)."* But `AccessMatrix.tsx:170` puts `glass … backdrop-blur-xl` on **each of five rows**, plus the loading/error/empty panels (`:133`,`:140`,`:161`); `PersonDirectory.tsx:126` puts it on every card (up to 3 columns × N rows); `ActivityLog.tsx:81`, `ApplicationRegister.tsx:99`, `RegisterStatus.tsx:28` each add one. All of these sit over the flat `--color-void` body wash, which is exactly the case the comment says has no payoff. Each `backdrop-filter` is a separate compositing layer and stacking context per frame. Dropping `backdrop-blur-*` from the list-row and panel cases (keeping it on the login card and the Sheet/DropdownMenu, which *do* float over content) costs nothing visually and removes a double-digit number of blur layers from the busiest admin screen.

**4.5 — Image handling is correct.** `next/image` is used with a static import and explicit dimensions in `Logo.tsx:18-25` (with a genuine explanation for the manual `width`/`height`: Turbopack can't probe AVIF), and with `fill`+`priority`+`sizes` in `HomeLanding.tsx:90-97`. The single raw `<img>` (`AccountSettings.tsx:372`) is a Supabase-generated SVG data URI, where `next/image` would do nothing — correctly reasoned in the comment at `:369-371`. `axe-core` is dev-only, dynamically imported (`AxeReporter.tsx:20`) and gated at `layout.tsx:58`, so it never reaches the production bundle.

---

## 5. Error handling & edge cases

### Should fix

**5.1 — `revokeAccess()` can fail silently.** `access.ts:77-84` issues an RLS-gated `UPDATE … .eq("id", grantId)` with no `.select()` and no `assertRowReturned()`. The repo's own helper file states the rule and the reason (`assert-write.ts:1-8`: *"Postgres UPDATE with a USING clause that matches 0 rows doesn't error… Every UPDATE gated by an RLS grant must check a row actually came back"*), and it is applied at the other two write sites (`applications.ts:203`, `documents.ts:58`) — just not here. User-visible consequence: `handleToggle` awaits the no-op, refetches, sees the grant still live, and re-renders the checkbox as checked. The box un-ticks and re-ticks with **no error and no toast**. Today's `access — admin all … FOR ALL USING (agv_is_admin())` policy (`20260722120000_agv_domain.sql:311-312`) means this isn't currently reachable — but it's the one place the codebase breaks its own documented invariant, on an admin-facing write, and the fix is two lines. Note the asymmetry: `grantAccess` is an INSERT, which *does* throw on a `WITH CHECK` failure, so grant fails loudly and revoke fails silently.

**5.2 — Access shows a nonsense empty state.** `AccessMatrix.tsx:160-163` renders `No one matches "{filter}".` whenever `pagedProfiles.length === 0` — including when `filter === ""`. With zero grantable profiles in the system (a brand-new deployment: one admin, no staff, no clients — the exact first-run state), the admin is told: **`No one matches "".`** Needs a branch on whether a filter is active.

**5.3 — The admin register has no empty state.** `ApplicationRegister.tsx:96-98` renders `<div className="mt-10">{emptyState}</div>`, and `emptyState` is optional (`:64`). `UserPortalView.tsx:73-83` passes a proper one; **`AdminDashboard.tsx:62-70` passes nothing**. So an admin with zero applications gets an intro line reading *"All 0 applications on record."* followed by an empty `<div>`. The two callers of the same shared component diverge on exactly the state that matters most on day one.

**5.4 — Activity swallows a failed profile fetch.** `ActivityLog.tsx:52-54`: `fetchAllProfiles().then(setProfiles).catch(() => setProfiles([]))`. On failure `actorName()` (`:57-60`) falls through to `?? actor`, so every audit-log row renders a raw UUID as the actor's name with no indication anything went wrong. The two *primary* fetches on the same screen both surface errors properly; the one that decorates them fails invisibly.

**5.5 — `RoleChangeDialog` opens with nothing selected, and wipes the selection on failure.** `:41-46` pre-selects the current role inside `handleOpenChange`, but that function only runs for Radix-*internal* open-state changes (trigger click, Escape, outside click). The dialog is opened externally by `open={editing !== null}` (`PersonDirectory.tsx:92`) with no `DialogTrigger` anywhere, so `handleOpenChange(true)` is never invoked and `pendingRole` stays `null`: no radio is checked, and Confirm is disabled (`:110`) until the user picks something. Separately, `handleConfirm`'s `finally` (`:54-56`) resets `pendingRole` unconditionally — and `PersonDirectory.handleRoleChange` catches its own errors (`:59-61`) rather than rethrowing, so on a failed save the dialog stays open with the user's choice erased and Confirm disabled again. Fix both with a `useEffect(() => { if (open && person) setPendingRole(person.role) }, [open, person])` and by moving the reset into the success path.

### Worth knowing, not urgent

**5.6 — Access grants have no success feedback**, while role changes do (`PersonDirectory.tsx:56` toasts, `AccessMatrix.handleToggle` does not). Given 5.1's failure mode is "the checkbox quietly reverts," the absence of positive confirmation on the same control is what makes that failure indistinguishable from a mis-click.

**5.7 — MFA factor removal has no confirmation.** `AccountSettings.tsx:348-355` — a single "Remove" click unenrolls the factor immediately. This is a security-relevant, non-undoable action, and the app already vendors `alert-dialog.tsx` (currently unused, see §10) for exactly this.

**5.8 — `expandedId` isn't reset by filter or pagination.** `AccessMatrix.onFilterChange` (`:118-121`) resets `page` but not `expandedId`, so a row expanded on page 1 stays "open" in state while off-screen and re-opens when you navigate back. Cosmetic.

**5.9 — Login collapses all failure modes into one message.** `page.tsx:74` renders "That email and password don't match an account." for *any* `signIn` error, including network failure and Supabase being unreachable. Deliberate for credential enumeration, but it will read as "wrong password" during an outage.

---

## 6. Responsive & cross-device behaviour

### Should fix

**6.1 — The bounded People shell starves its own content at phone heights.** `AppShell` with `boundedContent` (`:152`, `:262-267`) makes the page exactly viewport-height with `overflow-hidden`, `header` and `footer` both `shrink-0` (`:154`, `:271`). At 375×667 the fixed chrome adds up: DemoBanner ≈29px + header ≈66px + `main` `py-6` = 48px + eyebrow/`h1 text-4xl` block ≈72px + tab nav (`mt-7` + row) ≈68px + `mt-8` = 32px + section heading ≈18px + filter (`mt-9` + input) ≈72px + pagination row ≈44px + footer. The footer is `flex-col gap-6` at base (`:273`) — two stacked text blocks plus `py-8` ≈ **130px** that cannot be scrolled away. That leaves roughly **90–110px** for the row list, against a ~66px row: **about 1.5 rows visible on a phone, with no page scroll available.** STATUS.md records fixing exactly this symptom at desktop by cutting `py-12`→`py-6`; the same arithmetic at mobile heights is far worse and hasn't been addressed. The structural fix is to drop `boundedContent` below `sm` (let short viewports scroll normally) or collapse the footer to a single line at base.

**6.2 — `ApplicationDetail`'s pipeline stepper is `grid-cols-5` with no responsive override.** `:221` — five stages side by side at every viewport. At 375px, `main`'s `px-5` leaves 335px → ~67px per column, minus the label's own `px-1` → ~59px for text set at `text-label` (12px), uppercase, `tracking-[0.08em]` (`:255`). Stage labels from `PIPELINE` won't fit in ~6 characters per line, so every label wraps to three or four lines and the row becomes a ragged block. This is the one place in the app with a hard column count and no breakpoint escape — `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`, or a vertical stepper below `sm`, both work.

### Worth knowing, not urgent

**6.3 — `AccessMatrix` contains zero responsive prefixes.** Grepping `sm:|md:|lg:` across `src/components/admin/` returns exactly two hits, neither in `AccessMatrix`. Its rows are `flex items-center justify-between gap-3 px-4 py-3.5` at all widths (`:179`). It degrades acceptably rather than breaking — the right-hand group is `shrink-0` (`:194`) and the name has `truncate` (`:186`) — but at 375px the "N of M apps" chip plus chevron claims ~110px, so names truncate aggressively. Compare `PersonDirectory.tsx:119`, rebuilt in the same pass, which is properly mobile-first (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`, one column at base). Two components from one redesign, opposite levels of responsive care.

**6.4 — `ApplicationRegister` is a horizontal-scroll table below ~880px.** `:100` sets `min-w-[840px]` inside the `overflow-x-auto` wrapper at `:99`. Seven columns at phone width means the whole register scrolls sideways — legitimate for a dense data table, but it's the primary screen for `/portal` (client-facing) with no card fallback and no column priority.

**6.5 — Everything else is mobile-first and correct.** `HomeLanding.tsx:31` (`grid gap-10 lg:grid-cols-2`), `AccountSettings.tsx:32` (`sm:grid-cols-2`), `ApplicationDetail.tsx:170` (`grid-cols-2 sm:grid-cols-3`), and the `AppShell` header's `grid-cols-[1fr_auto_1fr]` with an explicitly-documented reason for the explicit column assignment (`:159-167`). The Sheet drawer is correctly gated `lg:hidden` (`:179`) against the desktop nav's `hidden … lg:flex` (`:204`).

---

## 7. Design system discipline

### Should fix

**7.1 — There are four different renderings of "the primary button," and the shadcn `Button` primitive is the least-used.** Grep for consumers of `components/ui/button` outside `ui/` returns three files, one of which is the dev-only proof page. The real inventory:

| Where | Class |
|---|---|
| `page.tsx:163`, `signup:237` | `rounded-full bg-signal py-3 text-sm font-semibold text-void` |
| `HomeLanding.tsx:60` | `rounded-full bg-signal px-6 py-3 text-sm font-semibold text-void` |
| `AccountSettings.tsx:162`, `:419` | `rounded-md bg-signal px-5 py-2.5 font-display text-sm font-bold uppercase tracking-[0.1em] text-void` |
| `SimplePagination`, `RoleChangeDialog` | `<Button>` → `rounded-md h-9 px-2.5 text-sm font-medium bg-primary` |

Full-round vs `radius-md`; `font-semibold` vs `font-bold` vs `font-medium`; sentence case vs uppercase-with-tracking; `py-3` vs `py-2.5` vs `h-9`. Two of these sit on the *same screen* in the People section. Slices 2–5 migrated the register, account, shell and admin surfaces onto shadcn primitives — login and signup were never brought along.

**7.2 — Login and signup still hand-roll `<input>`/`<label>` instead of the `Input`/`Label` primitives.** `page.tsx:120-151` and `signup/page.tsx:161-225` repeat this identical 12-class string **six times** across two files: `mt-1.5 w-full rounded-xl border border-ash/20 bg-white/50 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal focus:ring-1 focus:ring-signal/40`. `AccountSettings.tsx:487` uses `<Input>` for the same job. These are the first two screens a user ever sees and they're the least system-aligned in the app. (Side note: the `outline-none` in that string is inert — `globals.css:105-108`'s unlayered `:focus-visible` outranks any Tailwind utility layer, so the focus ring survives. Good outcome, misleading code. This is the known "unlayered project CSS beats Tailwind utilities" hazard showing up as a dead class rather than a bug, and is exactly the kind of thing that would be better as a lint rule than tribal knowledge.)

**7.3 — `h1` scale drifts.** `text-4xl sm:text-5xl` in `people/layout.tsx:15`, `ApplicationRegister.tsx:91`, `RegisterStatus.tsx:25`; `text-3xl sm:text-4xl` in `ApplicationDetail.tsx:150`; `text-3xl` flat in `page.tsx:109`; and **`text-2xl`** in `AccountSettings.tsx:28`. Five h1 treatments for a locked type scale.

### Worth knowing, not urgent

**7.4 — Two icon strategies coexist.** `PeopleSectionHeading.tsx:9` imports `InfoIcon` from `lucide-react`; every other app-level icon is a hand-written inline `<svg>` — the hamburger (`AppShell.tsx:181`), the Access chevron (`AccessMatrix.tsx:198-211`) and checkmark (`:244-253`), the four Home spec glyphs (`HomeLanding.tsx:20-25`), the Microsoft mark (duplicated verbatim in `page.tsx:20-29` and `signup/page.tsx:30-39`). `lucide-react` is a legitimate dependency regardless because the vendored `dialog`/`sheet`/`dropdown-menu`/`sonner` primitives use it — but with it already installed, one app-level lucide icon against ten hand-rolled SVGs is an unmade decision, not a considered one.

**7.5 — Honest read: crafted in the details, templated in the newest surfaces.** The evidence for *crafted* is real and specific — the `[1fr_auto_1fr]` header grid with a written explanation of why `justify-between` visibly drifts (`AppShell.tsx:158-167`); the skip link written as explicit CSS because Tailwind's `sr-only` wins the cascade on focus (`globals.css:123-132`); the `cn()` extension for the `text-label` token (`utils.ts:4-11`); role-named palette tokens with a comment insisting they be read as roles (`globals.css:17-25`); the deliberate choice of a Dialog+radio group over a floating Select to sidestep a known bug class (`RoleChangeDialog.tsx:2-10`). Almost none of that is what a template produces.

The evidence for *templated* is concentrated in the newest work. Directory cards and Access rows are, structurally, the same object — `glass rounded-2xl … px-4 py-3.5 … flex items-center justify-between gap-3` with an identical `h-9 w-9 rounded-full bg-signal/15 text-sm font-bold text-signal` avatar (`PersonDirectory.tsx:126-131` vs `AccessMatrix.tsx:179-184`) — built twice, days apart, with no shared component and no visual distinction between "a person you can re-role" and "a person you can grant apps to". Home is a hero and nothing else (`HomeLanding.tsx`), which reads less as restraint than as three deleted features leaving a gap. And §7.1's four button styles is the single clearest tell: a crafted system has one primary button.

The gap isn't taste — the taste is evident. It's that the newest surfaces were each built in isolation against a deadline, so the system-level decisions (one card, one row, one button) never got made.

---

## 8. Testing & quality gates

### Should fix

**8.1 — There is no automated test suite of any kind.** `package.json:5-9` defines `dev`, `build`, `start`, `lint` — no `test`. No `*.test.*` / `*.spec.*` files, no `vitest`/`jest`/`playwright` config or dependency, no `.github/` directory, no CI. `eslint.config.mjs:6-9` says so itself: *"There is no CI yet — `npm run lint` is the gate for now."*

**8.2 — The lint config is missing `eslint-plugin-react-hooks` (and `eslint-config-next`).** `eslint.config.mjs:19-38` composes `js.configs.recommended`, `tseslint.configs.recommended` and `jsx-a11y` — that's it. Neither plugin is in `package.json`'s devDependencies. So `rules-of-hooks` and `exhaustive-deps` do not run at all, and this is already costing you a live defect: `AppShell.tsx:102` computes `const allowedRoles = expect === undefined ? null : Array.isArray(expect) ? expect : [expect]` fresh on every render, then lists it in a `useEffect` dependency array at `:111`. For every caller passing a bare role (`expect="admin"` in `people/layout.tsx:9`) the array identity changes each render, so the route-guard effect re-runs on every render. `exhaustive-deps` flags this pattern by default. `PersonDirectory.tsx:48-50` (`useEffect(() => { load() }, [])` with `load` unlisted) is the same class.

**Recommendation — what to add first, and why that one.**

**Add `eslint-plugin-react-hooks` today** (a config edit plus one dependency), because it is the only gate that pays for itself in minutes and it has a confirmed catch waiting for it.

**Then, one integration test: the access grant/revoke round-trip in `AccessMatrix`,** with `src/lib/supabase/access.ts` mocked at the module boundary and the component driven through Testing Library. Not the role-change path, not a generic a11y snapshot. The argument:

- It is the app's **only unguarded write** (§5.1) — every other write goes through `assertRowReturned` or a server route that checks `updated.length`.
- Its failure mode is **silent and indistinguishable from success** (checkbox reverts, no toast), which is precisely the class of bug that survives manual QA. Everything else in this app fails loudly.
- The state machine is genuinely non-trivial and has already accreted correctness-relevant details worth pinning: the `pending` `Set` re-entrancy guard (`:47`,`:80`), the toggle→refetch→derive-checked cycle (`:88`,`:219-221`), filter-resets-page (`:118-121`), and `Math.min(page, totalPages)` clamping (`:112`) — the last of which is the only thing preventing an empty page after a filter narrows the result set.
- It's the surface most likely to change next: it has been rebuilt twice already (Table → Collapsible rows) with the write layer held constant each time. A test on the write contract is the thing that keeps surviving the redesigns.

A single test file covering "grant inserts and reflects", "revoke updates and reflects", and "a rejected write surfaces an error to the user" would have caught 5.1, 5.2 and 5.6. An a11y regression test on Dialog/Collapsible is the natural second — but Radix already guarantees most of what it would assert, whereas nothing at all guarantees the write path.

---

## 9. Dependency & security hygiene (front-end)

### Worth knowing, not urgent

**9.1 — `shadcn` (the CLI, `^4.16.0`) is in `dependencies`, not `devDependencies`** (`package.json:22`). It's needed at build time because `globals.css:4` does `@import "shadcn/tailwind.css"`, and Vercel installs devDependencies during builds — so moving it is safe and keeps a code-generation CLI (841 KB installed, with its own tree) out of the production dependency set.

**9.2 — Nothing in `package.json` is unmaintained or risky.** Next 16, React 19, Supabase JS 2.110, Zustand 5, Tailwind 4, `motion` 12 are all current. The `radix-ui` umbrella package (`^1.6.7`) rather than individual `@radix-ui/react-*` packages is a mild bundling risk in principle but tree-shakes correctly with Turbopack. `axe-core` is correctly a devDependency, dynamically imported and NODE_ENV-gated.

**9.3 — `dangerouslySetInnerHTML`: zero occurrences.** Confirmed by grep across `src/`.

**9.4 — Storage: one persisted store, and it holds nothing sensitive.** `localStorage`/`sessionStorage` are never called directly anywhere in `src/`. The only persistence is Zustand's `persist` in `src/lib/applications.ts:85-157`, keyed `agv-demo-applications`, with `partialize: (s) => ({ applications: s.applications, users: s.users })` (`:154`) — i.e. the *mock seed dataset* plus three hardcoded demo users with `@agv-demo.com` addresses (`:29-45`). **No tokens, no session, no real user data.** Notably, `useSession` (`session.ts:149`) is deliberately *not* persisted — auth state comes from Supabase's own cookie/session handling every time. That's the right call and worth preserving. The wrinkle is that this store is dead (§1.2), so what it's actually doing is writing a stale copy of fake data into every user's browser forever.

**9.5 — `console.*` in shipped code: effectively none.** Six hits total. Three are `console.error` in `app/auth/callback/route.ts` (`:55`,`:79`,`:112`) — a server-side Route Handler, where structured error logging is correct, not a leftover. The other three are in `dev/AxeReporter.tsx` (`:27`,`:31`,`:35`), which `layout.tsx:58` only mounts when `NODE_ENV === "development"`. No stray debug logging in any component.

**9.6 — The CSP is documented honestly.** `next.config.ts:19-32` carries `'unsafe-inline'` on `script-src` and `style-src`, with a written explanation of the nonce trade-off (`:1-16`). `style-src` genuinely needs it for Motion's runtime inline styles; `script-src` is the real reduction and is disclosed rather than hidden. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` are all set. Worth revisiting `script-src` if §4.2 removes Motion from the auth routes.

---

## 10. Tech debt inventory

### Should fix

**10.1 — Dead code, consolidated.** Every item below has zero references in `src/` (verified by grep):

| File / export | Size | Note |
|---|---|---|
| `src/components/ui/select.tsx` | 192 lines | Select removed app-wide; primitive never deleted |
| `src/components/ui/alert-dialog.tsx` | 199 lines | Last consumer was `RoleAssignment`, deleted |
| `src/components/ui/textarea.tsx` | 18 lines | Last consumer was `AnnouncementsPage`, deleted |
| `src/components/home/HomeShell.tsx` | 3 exports | Already flagged in STATUS.md — listed for completeness |
| `src/lib/applications.ts` — `PortalUser`, `visibleApplicationsFor`, `isApplicationVisible`, `setStage`, `addNote`, `toggleVisibility` | — | See §1.2 |
| `src/lib/mock-data.ts` — `TIERS` | `:53-57` | `TIER_OF_STAGE` is used by `StatusChip`; `TIERS` is not used anywhere |
| `src/lib/mock-data.ts` — `APPLICATIONS` | `:103-184` | Only consumer is the dead store's seed functions |

That's ~410 lines of unused shadcn primitives plus a whole dead data layer. Note the `alert-dialog` case in particular: §5.7 wants a confirmation dialog for MFA removal, and the primitive for it is sitting unused — deleting it and re-adding it later would re-run the "shadcn default silently survives the override" gauntlet from scratch. Worth a deliberate keep-or-delete call per file rather than a blanket sweep.

### Worth knowing, not urgent

**10.2 — `TODO`/`FIXME`/`HACK`/`XXX`: zero occurrences in `src/`.** Genuinely clean.

**10.3 — Half-migrated from the shadcn adoption slices.** Beyond §7.1/§7.2, three hand-rolled patterns still live alongside their vendored replacements: the native `<select>` at `ApplicationDetail.tsx:195-205` (defensible — it dodges the floating-positioning bug class — but the shadcn `Select` exists unused two directories away, so the *reason* isn't recorded where anyone would find it); the two hand-rolled `MicrosoftIcon` components duplicated verbatim between `page.tsx:20-29` and `signup/page.tsx:30-39`; and the `role="checkbox"` button at `AccessMatrix.tsx:231-254`, which `eslint.config.mjs:32-36` explicitly acknowledges as a deliberate custom control.

**10.4 — `src/app/dev/kokonut-proof/page.tsx` is a shipped route** guarded by `notFound()` when `NODE_ENV !== "development"` (`:6-8`), so it's inert in production. It's also the only remaining consumer of three `Button` variants (`secondary`, `ghost`, `destructive`), which slightly inflates the apparent usage of the `Button` primitive in §7.1 — real app usage is two files.

---

## Summary tiering

**Should fix (12):** 1.1 surface inconsistency · 1.2 dead applications store + no-op "Reset demo data" · 3.1 `ash` contrast fail · 3.2 non-text contrast on checkbox/input/icon · 3.3 heading hierarchy · 3.4 unannounced errors · 3.5 dialog focus loss · 3.6 pagination focus loss · 3.7 orphaned hint · 4.1 full-table refetch per toggle · 4.2 Motion on auth routes · 5.1 unguarded `revokeAccess` · 5.2 `No one matches ""` · 5.3 missing admin empty state · 5.4 swallowed profile fetch · 5.5 dialog pre-selection · 6.1 mobile bounded shell · 6.2 `grid-cols-5` stepper · 7.1 four button styles · 7.2 unmigrated auth forms · 7.3 h1 scale drift · 8.1 no tests · 8.2 missing react-hooks lint · 10.1 dead code

**Worth knowing, not urgent (20):** 1.3–1.5 · 2.1–2.3 · 3.8–3.10 · 4.3–4.5 · 5.6–5.9 · 6.3–6.5 · 7.4–7.5 · 9.1–9.6 · 10.2–10.4

**Credit where due, and load-bearing:** no `any`, no `@ts-ignore`, no `eslint-disable`, no `dangerouslySetInnerHTML`, no `TODO`s, no stray `console.*` in components, no sensitive data in `localStorage`, an unpersisted session store, `jsx-a11y` running on every component, a dev-time axe reporter, a documented CSP, complete form-label coverage, and explicit accessible names on every icon-only control. The hygiene floor here is well above average — which is exactly why the findings above are worth fixing rather than being lost in noise.
