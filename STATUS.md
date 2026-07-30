# AGV Portal — Status
Updated: 2026-07-30
Phase: Kokonut UI Adoption — Slices 0–5 complete (of 7 planned); live at a custom domain
State: On track. Visual foundation (Slice 0) plus five feature-surface migrations (Slices 1–5) landed, each with its own plan, subagent-driven execution, live browser verification, and a final whole-branch review. Nothing pushed. The app is now also live at `https://portal.arteagreenventures.com` (custom subdomain on Vercel, verified working). The previously-pending "July 31 Tier 1" batch has been committed and is no longer outstanding — see below.

## Done this session (and the sessions before it)

### Slice 0 — Foundation (7 commits: 3319ac3, 8b595c5, 60dbdc5, eb054d3, d8ea857, 430f0f7, 6165694)
Migrated tooling from Framer Motion to `motion`, set up shadcn/ui on the `radix-vega` preset (switched from an initial `nova` trial after empirically diffing both presets' output) plus Kokonut UI as a secondary registry in `components.json`, and built a token bridge in `globals.css` mapping shadcn's expected CSS variables onto AGV's existing locked color palette — verified live via `getComputedStyle()` that every shadcn color token resolves to an exact existing AGV token, not a new color. Final review found and fixed two real theming bugs (`--muted`/`--background` colliding, `--destructive-foreground` missing entirely).

### Slice 1 — Shell & Navigation (5 commits: 7d6f713, 1fc895f, 1caed5c, dd64d6d, 840fe1b)
Rebuilt `AppShell.tsx`'s mobile nav on shadcn `Sheet` and the account menu on shadcn `DropdownMenu`, removing ~40 lines of hand-rolled focus-trap/escape-key/outside-click logic. Also fixed a real redundancy bug (mobile hamburger and desktop pill-nav both visible at the same breakpoint). Rejected Kokonut's own branded nav components (`smooth-drawer`, `profile-dropdown`, `morphic-navbar`) as unsuitable — all three are demo compositions with hardcoded content, not generic primitives.

### Slice 2 — Home Hub Surfaces (3 commits: aa1e210, cc6e54a, f3d56ca)
Scoped down from the roadmap's stated 4 surfaces to just Announcements (the other 3 needed zero changes — documented as a finding, not skipped). Replaced hand-rolled toast state with `sonner`, migrated the form to shadcn `Input`/`Textarea`/`Label`. Added genuinely new user-facing feedback (a success toast on posting) that didn't exist before.

### Slice 3 — Account Settings (4 commits: e63d246, ea7e7af, a032371, 45e3ef0)
Migrated `AccountSettings.tsx`'s password and MFA sections to shadcn `Input`/`Label` plus `sonner` toasts. Zero changes to any Supabase Auth call (`signInWithPassword`, `updateUser`, `mfa.enroll`/`challengeAndVerify`/`unenroll`) — independently verified byte-identical by review. Verified MFA end-to-end using a freshly signed-up (non-seed) account and a real computed TOTP code. Fixed a real, wide-reaching `cn()` bug where the custom `text-label` font-size token was silently losing to color classes in the same className (affects 60+ call sites app-wide).

### Slice 4 — Applications Register (3 commits: dfed97f, 555ff9c, 3cfd2b3)
Migrated the shared sortable table (used by both admin and portal views) to shadcn `Table`, with zero changes to sort logic. Caught and fixed a padding-override trap (`TableCell`'s shorthand `p-2` silently surviving overrides) before it shipped, verified live via `getComputedStyle()`. Final review corrected the documented *mechanism* of that bug (it's a tailwind-merge conflict-detection gap, not a CSS-ordering issue as first assumed) — now recorded permanently as a code comment in `table.tsx` since this is the third slice in a row to hit the same class of "shadcn default silently survives override" bug (Slice 2: border color, Slice 3: `text-label`, Slice 4: padding).

### Slice 5 — Admin Surfaces IA Fix + Reskin (8 commits: b5fd7b0, 3254fbd, ef3da67, a646ddd, 4a6ad09, cf37403, c71627a, d3edb9e)
Before this slice started, the pre-existing "July 31 Tier 1" batch (role assignment, activity log, and an unrelated `agv_applications` column-tamper security fix) was isolated into its own commits (69a056e: the security fix; ae7dfad: role assignment + activity log) since Slice 5's scope directly overlapped those files — this was a bigger deal than prior slices' one-line isolation commits, so the user was asked how to handle it and chose to commit it as-is.

Split the crowded `/admin/access` page (Role assignment + Access matrix + Activity log, all stacked on one page) into three real routes under a new "People" nav entry (`/admin/people/roles`, `/access`, `/activity`), with a shared tab-nav layout and a redirect from the old URL — the IA change was confirmed with the user separately from the general roadmap sign-off, since the roadmap itself said this specific decision wasn't its to make unilaterally. Reskinned all three components: `RoleAssignment` onto shadcn `Select`/`AlertDialog`/`Button`, `AccessMatrix` onto shadcn `Table` (resolving the `role="checkbox"` padding hazard flagged at the end of Slice 4), `ActivityLog` onto shadcn `Tabs`.

Caught two genuine bugs beyond the plan's own hazard catalogue: (1) during planning, discovered `AlertDialogAction`/`AlertDialogCancel` wrap `Button` via Radix's `asChild`/`Slot`, which merges classNames by plain string concatenation rather than this project's `cn()`/tailwind-merge — deliberately left those two components without a `className` override rather than ship an unreliable one; (2) during live verification, found that migrating labels from `<label>` wrapping to a plain `<div>` had silently dropped both `Select` triggers' accessible names entirely (`role="combobox"` doesn't derive its name from visible text per the ARIA accname spec) — fixed with `id`/`aria-labelledby` pairing, confirmed against the real accessibility tree, not just a visual check.

The final whole-branch review caught one bug the controller's own live verification missed: `/admin/people` itself had no page (only the layout + subroutes), so the "People" nav link 404'd — the verification pass tested the three subroutes directly but never clicked the nav entry pointing at the parent segment. Fixed with an index-redirect page matching the existing `/admin/access` pattern, plus a handful of smaller polish fixes (inert `justify-start` on `ActivityLog`'s tabs, dead classes, a missing `font-normal`, a dialog dismissible mid-request). Two new entries added to the running "shadcn override silently loses" hazard catalogue: unlayered project CSS (`.glass` etc.) always outranks Tailwind utilities regardless of specificity, and variant-scoped pseudo-elements need their full variant chain repeated to override.

### Deployment — custom domain configured
`https://portal.arteagreenventures.com` is now live, pointing at the existing Vercel deployment via a CNAME record added in Wix (`portal` → the project's assigned `*.vercel-dns-*.com` target). Verified end-to-end: DNS resolves correctly (confirmed via direct nslookup against 8.8.8.8), and a live `curl` against the domain returns `200 OK` served by Vercel with a valid SSL certificate and the full security header set (CSP, HSTS, etc.) from the earlier hardening pass.

## Files added/changed (Kokonut work, all committed, nothing pushed)
- `src/lib/utils.ts` — `cn()` patched to recognize the `text-label` token
- `src/components/AppShell.tsx` — Sheet/DropdownMenu rebuild; nav entry now points to `/admin/people` labeled "People"
- `src/components/home/AnnouncementsPage.tsx`, `src/components/AccountSettings.tsx`, `src/components/ApplicationRegister.tsx`, `src/components/admin/{RoleAssignment,AccessMatrix,ActivityLog}.tsx` — migrated to shadcn primitives
- `src/components/ui/{sheet,dropdown-menu,input,label,textarea,sonner,table,select,alert-dialog,tabs}.tsx` — fetched via shadcn CLI (sonner hand-patched to drop `next-themes`; `table.tsx` carries a corrective comment on the padding trap)
- `src/app/admin/people/{layout.tsx,PeopleTabNav.tsx,roles/page.tsx,access/page.tsx,activity/page.tsx,page.tsx}` — new People route group
- `src/app/admin/access/page.tsx` — now a redirect to `/admin/people/roles`
- `src/app/layout.tsx` — mounts `<Toaster />`
- `globals.css`, `components.json` — Slice 0 token bridge and registry setup

## Decisions made
- Each slice gets its own plan written only when that slice starts, not all up front (roadmap decision, reaffirmed each slice).
- Kokonut's own branded registry components are evaluated case by case and rejected when they're demo compositions rather than generic primitives — happened in Slice 1.
- Recurring "shadcn base class silently survives `cn()` merge" bugs are now the reason for the standing rule: after any `npx shadcn add`, diff the fetched file against its override call sites before assuming an override works. Two more mechanisms in this family surfaced in Slice 5 (Radix `Slot`'s plain-string className merge; unlayered project CSS beating Tailwind utilities).
- The admin IA change (a "People" nav entry replacing "User access", with three tabbed sub-routes) was confirmed explicitly with the user before Slice 5's plan was written, since the roadmap flagged it as its own decision.
- The domain `portal.arteagreenventures.com` is a subdomain (not the root domain), configured via a CNAME in Wix pointing at the existing Vercel project — the root domain stays free for a separate marketing site if one is ever built.

## Known issues / TODO
- The orphaned duplicate `auth.users` account (no `agv_profiles` row) flagged in an earlier phase is still unresolved.
- Google OAuth remains separately pending, unaffected by this phase.
- `Tabs`'s `orientation` prop isn't forwarded to `TabsPrimitive.Root` (an upstream registry quirk, not introduced by this project) — irrelevant so far since only horizontal orientation is used; worth checking before any future vertical-`Tabs` usage.

## Blocked on / needs a decision
Nothing new. The orphaned-account question is still open, carried forward from before this phase.

## Next step
Slice 6 (`ApplicationDetail`, unified last per the roadmap's own decision) is the final slice on the roadmap — the roadmap only defines Slices 0 through 6 (seven slices total, not eight), so completing Slice 6 closes out the whole Kokonut UI Adoption program. A Slice 6 attempt was started and then fully reverted this session (plan written, Task 1 committed and Task 2 partway through, then the user asked to revert everything — repo is back at this commit, nothing from that attempt remains). Slice 6 gets a fresh plan whenever the user is ready to try again.
