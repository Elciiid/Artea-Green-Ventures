# AGV Portal — Status
Updated: 2026-07-30
Phase: Kokonut UI Adoption — Slices 0–4 complete (of 7 planned)
State: On track. Visual foundation (Slice 0) plus four feature-surface migrations (Slices 1–4) landed, each with its own plan, subagent-driven execution, live browser verification, and a final whole-branch review. Nothing pushed. A separate, unrelated "July 31 Tier 1" batch of work (role assignment, activity log, a DB migration) remains uncommitted in the working tree from before this phase started and has been deliberately left untouched throughout — see "Known issues / TODO" below.

## Done this session (and the session before it)

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

## Files added/changed (Kokonut work, all committed, nothing pushed)
- `src/lib/utils.ts` — `cn()` patched to recognize the `text-label` token
- `src/components/AppShell.tsx` — Sheet/DropdownMenu rebuild
- `src/components/home/AnnouncementsPage.tsx`, `src/components/AccountSettings.tsx`, `src/components/ApplicationRegister.tsx` — migrated to shadcn primitives
- `src/components/ui/{sheet,dropdown-menu,input,label,textarea,sonner,table}.tsx` — fetched via shadcn CLI (sonner hand-patched to drop `next-themes`, `table.tsx` carries a corrective comment on the padding trap)
- `src/app/layout.tsx` — mounts `<Toaster />`
- `globals.css`, `components.json` — Slice 0 token bridge and registry setup

## Decisions made
- Each slice gets its own plan written only when that slice starts, not all up front (roadmap decision, reaffirmed each slice).
- Kokonut's own branded registry components are evaluated case by case and rejected when they're demo compositions rather than generic primitives — happened in Slice 1, may recur in later slices.
- Recurring "shadcn base class silently survives `cn()` merge" bugs are now the reason for the standing rule: after any `npx shadcn add`, diff the fetched file against its override call sites before assuming an override works.

## Known issues / TODO
- The pre-existing "July 31 Tier 1" batch is still uncommitted and untouched: `src/app/admin/access/page.tsx` (modified), plus new/untracked `src/app/api/admin/`, `src/components/admin/ActivityLog.tsx`, `src/components/admin/RoleAssignment.tsx`, `src/lib/supabase/auditLog.ts`, `src/lib/supabase/roles.ts`, `src/lib/supabase/loginActivity.ts`, `supabase/migrations/20260728120000_prevent_application_field_tamper.sql`. Confirmed non-overlapping with every Kokonut slice's files so far; will need its own decision on when to commit/review, separate from this phase.
- Flagged for Slice 5: `AccessMatrix.tsx` is the only other raw `<table>` in the codebase; its `role="checkbox"` cells will trigger `TableCell`'s `[&:has([role=checkbox])]:pr-0` clause if migrated to the same `Table` primitive — a different hazard from the padding trap already solved, worth knowing going in.
- The orphaned duplicate `auth.users` account (no `agv_profiles` row) flagged in an earlier phase is still unresolved.
- Google OAuth remains separately pending, unaffected by this phase.

## Blocked on / needs a decision
Nothing new. The orphaned-account question and the Tier 1 batch's commit/review timing are both still open, carried forward from before this phase.

## Next step
Slice 5 (Admin surfaces IA fix + reskin: Role assignment / Access matrix / Activity log) gets its own detailed plan when the user is ready to start it, followed by Slice 6 (`ApplicationDetail`, unified last per the roadmap's own decision) and Slice 7 to close out the roadmap.
