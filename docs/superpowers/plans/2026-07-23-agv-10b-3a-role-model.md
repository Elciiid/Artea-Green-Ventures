# AGV Portal 10b-3a — Role Model Change (user→staff, add client) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `agv_profiles` role value `user` → `staff`, add a genuine third role `client`, give `staff` real write rights on granted applications (status change, add-note) while `client` stays read-only always, and add `visible_to_client` filtering on activity entries — the foundation the rest of 10b-3 (real writes, three-role access UI, Storage) builds on.

**Architecture:** A single new migration renames the role in place, widens the check constraint, adds the `visible_to_client` column, and adds/updates RLS policies via two new SECURITY DEFINER helper predicates (`agv_is_staff()`, `agv_is_client()`) alongside the existing `agv_is_admin()`/`agv_has_app_access()`. Seed scripts get a renamed `staff` demo pairing plus one new `client` demo account and grant, so every claim is provable against real data. App code gets the mechanical rename plus a small, deliberate widening of `AppShell`'s role guard (`expect?: Role` → `expect?: Role | Role[]`) so both `staff` and `client` can reach the existing, unmodified `/portal` surfaces — no new UI is built in this slice.

**Tech Stack:** Supabase Postgres (migrations, RLS), Next.js 16 + TypeScript client code, existing `@supabase/supabase-js` browser client.

## Global Constraints

- Preserve everything from Phases 9, 14a, 16, 10a, 10c, and 10b-1/2 — visual treatment, navigation, account settings, MFA, and the RLS isolation already proven. This slice touches zero visual output.
- **No visual/branding work.** Any new client-facing capability must be functional, not designed — this slice deliberately reuses the existing, unmodified `UserPortalView`/`UserApplicationView` components for `client` role rather than building anything new for them. No new login-page card copy, no new nav items.
- No delegation enrichment (`granted_by`, scope, self-service) — later authorization phase, not this one.
- No audit trail UI — the audit log keeps logging regardless (its triggers are already attached to every table this migration touches).
- US spelling, Month Day, Year date format for any new copy (none is expected in this slice beyond code comments and a demo name).
- Don't touch the `client_name` field on application records (the display field, meaning the commissioning organization) — unrelated to the new `client` role value. Do not rename or touch `agv_applications.client_name` or `Application.clientName` anywhere in this plan.
- **No automated test suite exists in this repo.** Verification is `npm run lint`, `npm run build` (also full-typechecks; safe to run without live DB per the earlier `migrate-deploy` removal), `node --check` for seed scripts (syntax only — this plan cannot run seed scripts itself; they need a `service_role` key that must never enter this session), and direct empirical proof via real Supabase REST calls with real per-role JWTs (the same method that proved 10b-1's and 10b-2's RLS boundaries) plus a light UI-level sanity check.
- Column-level write restriction (e.g., preventing staff from updating `title`/`client_name` via the new UPDATE policy, only `stage`/`status_note`) is **explicitly out of scope for this slice** — the policy grants row-level UPDATE on a granted application to `staff`; the application layer (10b-3b) is what actually constrains which fields get sent. Flag this as a deliberate, documented simplification, not an oversight.

---

## File Structure

- **Create** `supabase/migrations/20260723090000_role_staff_client.sql` — the whole role-model migration: rename, constraint, `visible_to_client` column, two new role-predicate functions, new/updated RLS policies.
- **Modify** `supabase/seed-users.mjs` — rename `user1`/`user2`'s `role: "user"` → `role: "staff"`; add one new `client1@agv-demo.com` demo account.
- **Modify** `supabase/seed-domain.mjs` — add a live grant for `client1@agv-demo.com` on `AGV-2026-0142` (the same application `user1`/staff already holds, so client-vs-staff activity visibility is directly comparable); mark exactly one of that application's existing timeline entries `visible_to_client: true`.
- **Modify** `src/lib/session.ts` — `Role` type gains `"client"`; `DEV_ACCOUNTS` renamed/extended; `loadAccount()`'s metadata fallback default; new exported `PORTAL_ROLES` constant.
- **Modify** `src/components/AppShell.tsx` — `expect` prop widened to accept `Role | Role[]`.
- **Modify** `src/app/portal/page.tsx`, `src/app/portal/applications/[id]/page.tsx` — `expect="user"` → `expect={PORTAL_ROLES}`.
- **Modify** `src/lib/applications.ts` — mock `seedUsers()` role literals `"user"` → `"staff"` (type-correctness only; this file and its mock `AccessMatrix` consumer are rewired for real data in 10b-3c, not here).
- **Modify** `src/components/admin/AccessMatrix.tsx` — `u.role === "user"` → `u.role === "staff"` (same type-correctness reason; still the mock component, unchanged visually).

---

## Task 1: Migration — role rename, `client` role, `visible_to_client`, RLS

**Files:**
- Create: `supabase/migrations/20260723090000_role_staff_client.sql`

**Interfaces:**
- Consumes: existing `agv_is_admin()`, `agv_has_app_access(app uuid)` from `supabase/migrations/20260722120000_agv_domain.sql` (do not modify that file — this is a new migration).
- Produces: `agv_is_staff()`, `agv_is_client()` (both `boolean`, `SECURITY DEFINER`, same shape as `agv_is_admin()`) — used by this migration's own new policies; not consumed by any other task in this plan, but will be reused in 10b-3b/3c.

- [ ] **Step 1: Write the full migration file**

```sql
-- Phase 10b-3a — Role model change: user → staff rename, add the client
-- role, visible_to_client filtering on activity entries, and the RLS this
-- all depends on. Everything in 10b-3 (real writes, three-role access UI,
-- Storage) builds on this.
--
-- "user" always meant AGV staff, never a client — this rename resolves that
-- ambiguity rather than introducing a new concept. client is a genuinely new
-- role: read-only always, even on applications it's granted to, filtered
-- further by visible_to_client on activity entries.

-- ————————————————————————————————————————————————————————————————
-- Role rename (data) + widened constraint (schema)
-- ————————————————————————————————————————————————————————————————

update public.agv_profiles set role = 'staff' where role = 'user';

alter table public.agv_profiles drop constraint if exists agv_profiles_role_check;
alter table public.agv_profiles
  add constraint agv_profiles_role_check check (role in ('admin', 'staff', 'client'));

-- ————————————————————————————————————————————————————————————————
-- visible_to_client on activity entries
-- ————————————————————————————————————————————————————————————————

alter table public.agv_activity_entries
  add column if not exists visible_to_client boolean not null default false;

comment on column public.agv_activity_entries.visible_to_client is
  'Whether a client-role reader may see this entry. Defaults false so every existing/system-generated entry stays staff+admin-only unless explicitly marked visible. Phase 10b-3a.';

-- ————————————————————————————————————————————————————————————————
-- Role helper predicates (SECURITY DEFINER, same shape as agv_is_admin())
-- ————————————————————————————————————————————————————————————————

create or replace function public.agv_is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_profiles
    where id = auth.uid() and role = 'staff'
  );
$$;

create or replace function public.agv_is_client()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agv_profiles
    where id = auth.uid() and role = 'client'
  );
$$;

-- ————————————————————————————————————————————————————————————————
-- agv_applications: staff gets real write rights via a live grant.
-- client is deliberately excluded here — no using()/with check() clause
-- ever evaluates true for a client role, so client has no path to UPDATE
-- regardless of grants. Row-level only in this slice — the application
-- layer (10b-3b) is what constrains which columns actually get sent;
-- see the plan's Global Constraints for why that's an accepted scope cut.
-- ————————————————————————————————————————————————————————————————

drop policy if exists "applications — staff write granted" on public.agv_applications;
create policy "applications — staff write granted" on public.agv_applications
  for update using (agv_is_staff() and agv_has_app_access(id))
             with check (agv_is_staff() and agv_has_app_access(id));

-- ————————————————————————————————————————————————————————————————
-- agv_activity_entries: staff can add entries on a granted application
-- (add-note); the old blanket "user read granted" policy is replaced with
-- one that additionally filters client reads to visible_to_client = true.
-- Staff reads are unaffected by visible_to_client — it's a client-only cut.
-- ————————————————————————————————————————————————————————————————

drop policy if exists "activity — staff write granted" on public.agv_activity_entries;
create policy "activity — staff write granted" on public.agv_activity_entries
  for insert with check (agv_is_staff() and agv_has_app_access(application_id));

drop policy if exists "activity — user read granted" on public.agv_activity_entries;
drop policy if exists "activity — read granted" on public.agv_activity_entries;
create policy "activity — read granted" on public.agv_activity_entries
  for select using (
    agv_has_app_access(application_id)
    and (agv_is_staff() or (agv_is_client() and visible_to_client))
  );

-- agv_documents and the agv_applications SELECT policy are already
-- role-agnostic via agv_has_app_access() — staff and client both continue
-- to read through them unchanged. Only activity reads split by role here.
```

- [ ] **Step 2: Self-check the migration reads cleanly**

There's no way to apply or dry-run this migration in this environment (no DB credentials in this session, by standing project rule). Read the file back once and confirm: every `drop policy if exists` has a matching `create policy` immediately after (no orphaned drops), the two new functions are defined before any policy that calls them, and the `update ... set role = 'staff'` runs before the constraint that would reject the old `'user'` value if it ran after.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723090000_role_staff_client.sql
git commit -m "Add 10b-3a migration: role rename (user→staff), client role, visible_to_client RLS"
```

---

## Task 2: Seed scripts — rename, new client demo account, client grant

**Files:**
- Modify: `supabase/seed-users.mjs`
- Modify: `supabase/seed-domain.mjs`

**Interfaces:**
- Consumes: Task 1's migration (must be applied before these scripts are re-run by the user — they insert/update rows against the new constraint and column).
- Produces: `client1@agv-demo.com` as a real Supabase Auth user + `agv_profiles` row with `role = 'client'`; a live grant for that account on `AGV-2026-0142`; one `visible_to_client = true` activity entry on that same application.

- [ ] **Step 1: Update `seed-users.mjs`'s `ACCOUNTS` array**

Replace:

```js
const ACCOUNTS = [
  { email: "admin@agv-demo.com", name: "A. Mercer", role: "admin" },
  { email: "user1@agv-demo.com", name: "S. Whitfield", role: "user" },
  { email: "user2@agv-demo.com", name: "R. Santiago", role: "user" },
];
```

with:

```js
const ACCOUNTS = [
  { email: "admin@agv-demo.com", name: "A. Mercer", role: "admin" },
  { email: "user1@agv-demo.com", name: "S. Whitfield", role: "staff" },
  { email: "user2@agv-demo.com", name: "R. Santiago", role: "staff" },
  { email: "client1@agv-demo.com", name: "N. Reyes", role: "client" },
];
```

(`user1`/`user2` keep their existing email addresses and display names — only the `role` value changes, matching the migration's data rename. `client1`'s email follows the same seed-account naming convention as `user1`/`user2`.)

- [ ] **Step 2: Update `seed-domain.mjs`'s `GRANTS` array**

Replace:

```js
const GRANTS = [
  { email: "user1@agv-demo.com", references: ["AGV-2026-0142", "AGV-2026-0118"] },
  { email: "user2@agv-demo.com", references: ["AGV-2026-0161"] },
];
```

with:

```js
const GRANTS = [
  { email: "user1@agv-demo.com", references: ["AGV-2026-0142", "AGV-2026-0118"] },
  { email: "user2@agv-demo.com", references: ["AGV-2026-0161"] },
  { email: "client1@agv-demo.com", references: ["AGV-2026-0142"] },
];
```

(`client1` is granted the same application `user1` holds — `AGV-2026-0142` — so 10b-3a's verification can directly compare what a `staff` reader sees against what a `client` reader sees on the identical record.)

- [ ] **Step 3: Add `visible_to_client` to the timeline entry shape and mark one entry visible**

In the `APPS` array, find `AGV-2026-0142`'s `timeline` (it's the first entry in the array). Replace:

```js
    timeline: [
      { at: "2026-06-18", actor: "System", kind: "system", body: "We received this application through the portal." },
      { at: "2026-06-19", actor: "A. Mercer", kind: "status", body: "Status moved to Under Review." },
      { at: "2026-06-24", actor: "S. Whitfield", kind: "comment", body: "We asked the delivery contractor for baseline noise and vibration data." },
      { at: "2026-07-02", actor: "T. Alvarez", kind: "document", body: "Uploaded the EIS Addendum (Rev B)." },
      { at: "2026-07-09", actor: "S. Whitfield", kind: "comment", body: "Section 4 review complete. Groundwater assessment underway." },
    ],
```

with:

```js
    timeline: [
      { at: "2026-06-18", actor: "System", kind: "system", body: "We received this application through the portal.", visibleToClient: true },
      { at: "2026-06-19", actor: "A. Mercer", kind: "status", body: "Status moved to Under Review." },
      { at: "2026-06-24", actor: "S. Whitfield", kind: "comment", body: "We asked the delivery contractor for baseline noise and vibration data." },
      { at: "2026-07-02", actor: "T. Alvarez", kind: "document", body: "Uploaded the EIS Addendum (Rev B)." },
      { at: "2026-07-09", actor: "S. Whitfield", kind: "comment", body: "Section 4 review complete. Groundwater assessment underway." },
    ],
```

(Only the first, system-generated entry is marked visible — safest choice, since it doesn't require judging whether internal staff commentary is client-appropriate. The other four entries have no `visibleToClient` key, which is fine — the mapping step below defaults it.)

Do **not** add `visibleToClient` to any other application's timeline — only `AGV-2026-0142` needs it for this slice's verification.

- [ ] **Step 4: Read `visibleToClient` in the `actRows` mapping**

Find:

```js
    const actRows = timeline.map((t, i) => ({
      id: uuid5(`${app.reference}:act:${i}`),
      application_id: appId,
      occurred_at: noon(t.at),
      actor: t.actor,
      kind: t.kind,
      body: t.body,
    }));
```

Replace with:

```js
    const actRows = timeline.map((t, i) => ({
      id: uuid5(`${app.reference}:act:${i}`),
      application_id: appId,
      occurred_at: noon(t.at),
      actor: t.actor,
      kind: t.kind,
      body: t.body,
      visible_to_client: t.visibleToClient ?? false,
    }));
```

- [ ] **Step 5: Syntax-check both files**

Run: `node --check supabase/seed-users.mjs`
Run: `node --check supabase/seed-domain.mjs`
Expected: no output, exit code 0 for both (syntax only — no DB connection, no credentials needed).

- [ ] **Step 6: Commit**

```bash
git add supabase/seed-users.mjs supabase/seed-domain.mjs
git commit -m "Seed: rename staff demo accounts, add client1 demo account + grant + visible_to_client entry"
```

---

## Task 3: App code — role rename, `client` role support, `AppShell` role-guard widening

**Files:**
- Modify: `src/lib/session.ts`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/app/portal/page.tsx`
- Modify: `src/app/portal/applications/[id]/page.tsx`
- Modify: `src/lib/applications.ts`
- Modify: `src/components/admin/AccessMatrix.tsx`

**Interfaces:**
- Produces: `Role = "admin" | "staff" | "client"` (was `"admin" | "user"`), `PORTAL_ROLES: Role[]` — the two non-admin roles that share `/portal`. `AppShell`'s `expect` prop becomes `Role | Role[]`.

- [ ] **Step 1: `src/lib/session.ts` — widen `Role`, rename `DEV_ACCOUNTS`, add `PORTAL_ROLES`**

Replace:

```ts
export type Role = "admin" | "user";
```

with:

```ts
export type Role = "admin" | "staff" | "client";

/** The two non-admin roles, which share every /portal surface. */
export const PORTAL_ROLES: Role[] = ["staff", "client"];
```

Replace:

```ts
export const DEV_ACCOUNTS: { email: string; name: string; role: Role }[] = [
  { email: "admin@agv-demo.com", name: "A. Mercer", role: "admin" },
  { email: "user1@agv-demo.com", name: "S. Whitfield", role: "user" },
  { email: "user2@agv-demo.com", name: "R. Santiago", role: "user" },
];
```

with:

```ts
export const DEV_ACCOUNTS: { email: string; name: string; role: Role }[] = [
  { email: "admin@agv-demo.com", name: "A. Mercer", role: "admin" },
  { email: "user1@agv-demo.com", name: "S. Whitfield", role: "staff" },
  { email: "user2@agv-demo.com", name: "R. Santiago", role: "staff" },
  { email: "client1@agv-demo.com", name: "N. Reyes", role: "client" },
];
```

Find the metadata fallback in `loadAccount()`:

```ts
    role: profile?.role ?? ((meta.role as Role) ?? "user"),
```

Replace with:

```ts
    role: profile?.role ?? ((meta.role as Role) ?? "staff"),
```

(This fallback only fires if the `agv_profiles` row isn't readable yet — matches the old default's intent of "assume the least-privileged non-client role" as a fail-safe. `roleHome()`, `nextAccount()`, and `isSeedAccount()` need no changes — `roleHome()`'s `role === "admin" ? "/admin" : "/portal"` already routes both new roles correctly, and the other two are generic over `DEV_ACCOUNTS`.)

- [ ] **Step 2: `src/components/AppShell.tsx` — widen `expect` to `Role | Role[]`**

Find:

```tsx
export default function AppShell({
  expect,
  children,
}: {
  expect?: Role;
  children: React.ReactNode;
}) {
```

Replace with:

```tsx
export default function AppShell({
  expect,
  children,
}: {
  expect?: Role | Role[];
  children: React.ReactNode;
}) {
```

Immediately after the existing `const account = ...` / `const hydrated = ...` / `const signOut = ...` / `const resetDemo = ...` lines, add:

```tsx
  const allowedRoles = expect === undefined ? null : Array.isArray(expect) ? expect : [expect];
```

Find:

```tsx
  useEffect(() => {
    if (!hydrated) return;
    if (!account) {
      router.replace("/");
      return;
    }
    if (expect && account.role !== expect) router.replace(roleHome(account.role));
  }, [hydrated, account, expect, router]);
```

Replace with:

```tsx
  useEffect(() => {
    if (!hydrated) return;
    if (!account) {
      router.replace("/");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(account.role)) router.replace(roleHome(account.role));
  }, [hydrated, account, allowedRoles, router]);
```

Find:

```tsx
  if (!hydrated || !account || (expect && account.role !== expect)) {
```

Replace with:

```tsx
  if (!hydrated || !account || (allowedRoles && !allowedRoles.includes(account.role))) {
```

Everything else in the file (the JSX, `recordsNav`, `SideGroupLabel`, `SideLink`, the reset-demo button's `account.role === "admin"` check) is unchanged — `recordsNav(role: Role)` already compiles fine against the widened 3-value union since its logic is `role === "admin" ? [...] : [...]`.

- [ ] **Step 3: Update the two portal page routes**

In `src/app/portal/page.tsx`, replace:

```tsx
import AppShell from "@/components/AppShell";
```

with:

```tsx
import AppShell from "@/components/AppShell";
import { PORTAL_ROLES } from "@/lib/session";
```

and replace:

```tsx
    <AppShell expect="user">
```

with:

```tsx
    <AppShell expect={PORTAL_ROLES}>
```

Apply the identical two changes to `src/app/portal/applications/[id]/page.tsx`.

- [ ] **Step 4: `src/lib/applications.ts` — rename mock role literals for type-correctness**

Find (in `seedUsers()`):

```ts
    {
      id: "user1@agv-demo.com",
      name: "S. Whitfield",
      role: "user",
      visibleApplicationIds: ["AGV-2026-0142", "AGV-2026-0118"],
    },
    {
      id: "user2@agv-demo.com",
      name: "R. Santiago",
      role: "user",
      visibleApplicationIds: ["AGV-2026-0161"],
    },
```

Replace both `role: "user",` occurrences with `role: "staff",`. Do not add a mock `client1` entry here — this mock store is entirely superseded by 10b-3c's real access-UI rewrite; it only needs to keep compiling against the widened `Role` type, not model the new role.

- [ ] **Step 5: `src/components/admin/AccessMatrix.tsx` — same type-correctness rename**

Find:

```tsx
  const normalUsers = users.filter((u) => u.role === "user");
```

Replace with:

```tsx
  const normalUsers = users.filter((u) => u.role === "staff");
```

No other change to this file — it's still the mock-backed checkbox UI, unchanged visually, superseded in 10b-3c.

- [ ] **Step 6: Lint and build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds. This is the most important check in this task — it full-typechecks every file that references `Role`, and would catch any remaining `"user"` string literal being compared/assigned against the now-3-value union (TypeScript would flag `"user"` as not assignable to `Role`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/session.ts src/components/AppShell.tsx src/app/portal/page.tsx "src/app/portal/applications/[id]/page.tsx" src/lib/applications.ts src/components/admin/AccessMatrix.tsx
git commit -m "Rename user role to staff, add client role support to Role type and AppShell"
```

---

## Task 4: Ask the user to apply the migration and re-run both seed scripts

**Files:** none (coordination step).

- [ ] **Step 1: State exactly what the user needs to do**, mirroring the 10b-1 handoff pattern:
  1. Apply `supabase/migrations/20260723090000_role_staff_client.sql` via the Supabase SQL Editor (or `supabase db push`).
  2. Re-run `node supabase/seed-users.mjs` (creates `client1@agv-demo.com`, renames `user1`/`user2`'s role to `staff` in both `auth.users` metadata and `agv_profiles`).
  3. Re-run `node supabase/seed-domain.mjs` (adds `client1`'s grant on `AGV-2026-0142`, sets `visible_to_client = true` on that application's first activity entry).
  4. Confirm both scripts completed without error.

This step blocks Task 5 (empirical verification) but not Tasks 1-3 (pure code changes) — those can all be written and committed before the user acts.

---

## Task 5: Empirical verification — staff writes succeed, client writes are rejected, `visible_to_client` filters correctly

This is not a subagent task — it's performed directly by the controller against the live Supabase project and the running dev server, the same standard of proof 10b-1 and 10b-2 established. Do this only after Task 4 is confirmed done.

**Files:** none (verification only).

- [ ] **Step 1: Direct REST proof — staff can write, client cannot**

Using each account's real JWT (via `/auth/v1/token?grant_type=password`, the same method used throughout 10b-1/10b-2):

- Sign in as `user1@agv-demo.com` (now role `staff`, granted `AGV-2026-0142`). `PATCH` `agv_applications?reference=eq.AGV-2026-0142` with `{"status_note": "10b-3a write test"}`. Expected: `200`/`204` success, row updated.
- Revert that test write back (`PATCH` again with the original `status_note`, which was `null` for this application — confirm via a `GET` first if unsure) so the seeded state stays clean for later slices.
- Sign in as `client1@agv-demo.com` (role `client`, also granted `AGV-2026-0142`). Attempt the identical `PATCH`. Expected: rejected — either `0` rows affected (RLS silently filters, PostgREST returns `200` with empty body) or a permission error, depending on how PostgREST reports a `WITH CHECK` failure with no matching `USING` row; confirm by following up with a `GET` that the row's `status_note` is unchanged. Either signal counts as proof, but do the follow-up `GET` regardless to be certain no write actually landed.
- Sign in as `user2@agv-demo.com` (role `staff`, granted `AGV-2026-0161` but NOT `AGV-2026-0142`). Attempt a `PATCH` on `AGV-2026-0142`. Expected: rejected (staff write policy requires `agv_has_app_access`, not just the staff role) — confirms the write policy is grant-scoped, not role-wide.

- [ ] **Step 2: Direct REST proof — `visible_to_client` filtering**

- As `user1@agv-demo.com` (staff, granted `AGV-2026-0142`): `GET agv_activity_entries?application_id=eq.<uuid>&select=body`. Expected: all 5 seeded entries.
- As `client1@agv-demo.com` (client, granted the same application): identical `GET`. Expected: exactly 1 entry — the one marked `visible_to_client: true` in Task 2 ("We received this application through the portal.").
- As `client1@agv-demo.com`: attempt `POST` a new `agv_activity_entries` row on `AGV-2026-0142` (add-note attempt). Expected: rejected — no INSERT policy grants this to `client`.

- [ ] **Step 3: Light UI-level sanity check**

Using the Claude Browser tool against the running dev server (port 3170): sign in as `client1@agv-demo.com` (via the manual email/password form — no demo card exists for this account per the plan's no-new-copy constraint) and confirm `/portal` loads without a redirect loop, showing `AGV-2026-0142` in the register (reusing the unmodified `UserPortalView`). Open the application detail and confirm it renders read-only with no edit controls (unchanged `UserApplicationView`/`ApplicationDetail` behavior — `canEdit` is never passed `true` outside the admin route, so this should already hold with zero new code, but confirm it rather than assume it).

- [ ] **Step 4: Record results**

Note exactly which account, which request, and what was expected vs. observed for each check above — this goes into `STATUS.md` in Task 6.

---

## Task 6: Update STATUS.md

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Overwrite `STATUS.md`** using the project's standard template, reporting:
  - State: complete (or blocked, with specifics).
  - Done this session: role rename, `client` role addition, `visible_to_client` column + RLS, seed updates, `AppShell` role-guard widening.
  - **Call out explicitly, per the spec's own instruction:** staff now has real edit rights on granted applications — this is a deliberate reversal of 10b-2's admin-only-edit design, not a bug fix.
  - Files added/changed: the full list from "File Structure" above.
  - Decisions made: `visible_to_client` enforced via RLS, not application code (zero query-layer changes needed); `AppShell`'s `expect` widened to `Role | Role[]` rather than building new client-specific routes; no column-level UPDATE restriction on the new staff write policy (row-level only, documented scope cut); no new login-page demo card for `client1` (functional-only, per the "no visual work" constraint).
  - Known issues / TODO: staff's `AdminApplicationView`-equivalent editing surface doesn't exist yet — staff can now write via the API/RLS, but nothing in the UI calls it yet (that's 10b-3b). The old local-only edit shim in `AdminApplicationView.tsx` is untouched by this slice.
  - Verification detail: the specific account/request/expected-vs-observed results from Task 5 — not just "verified."
  - Next step: 10b-3b (real writes — replace the local-only shim, wire staff's new edit rights into the UI), then 10b-3c (access UI for three roles) and 10b-3d (Storage), independent of each other and of 3b.

- [ ] **Step 2: Commit**

```bash
git add STATUS.md
git commit -m "Close out Phase 10b-3a: role model change verified end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** role rename → Task 1 (migration) + Task 3 (app code) + Task 2 (seed). New `client` role → Task 1. Staff real edit rights (schema/RLS layer) → Task 1; UI wiring explicitly deferred to 10b-3b per the plan's own split rationale. `client` read-only always → Task 1's policies (no UPDATE/INSERT path ever matches a client role). `visible_to_client` → Task 1 (column + policy) + Task 2 (seed data to prove it). Empirical proof of both write boundaries → Task 5.
- **Placeholder scan:** every task has complete, exact code (full migration SQL, full before/after snippets for every file edit) — no TODOs, no "similar to Task N" shortcuts.
- **Type consistency:** `Role = "admin" | "staff" | "client"` is defined once (Task 3, Step 1) and every other reference (`PORTAL_ROLES`, `DEV_ACCOUNTS`, `AppShell`'s `expect`, the mock store, `AccessMatrix`) is updated against that same definition in the same task, so `npm run build`'s full typecheck (Task 3, Step 6) is the actual proof of consistency, not just this review's read-through.
