# Fix: signup role-injection privilege escalation

Branch: `fix-signup-role-injection` (worktree). Date: 2026-08-05/06.

## The vulnerability

`agv_handle_new_user()` — a `SECURITY DEFINER` trigger function, `AFTER INSERT
ON auth.users`, most recently defined in
`supabase/migrations/20260724100000_fix_new_user_default_role.sql` — inserted
every new `agv_profiles` row with:

```sql
insert into public.agv_profiles (id, name, role)
values (
  new.id,
  coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
  coalesce(new.raw_user_meta_data ->> 'role', 'staff')
)
on conflict (id) do nothing;
```

`raw_user_meta_data` is populated from whatever the caller passes as
`options: { data: {...} }` to Supabase Auth's `signUp()`, or as
`user_metadata` to `auth.admin.createUser()`. This app's own
`/api/auth/signup` route legitimately used this channel to pass
`role: "staff"` / `role: "client"` — but Supabase Auth's REST API is directly
reachable by anyone holding the public anon key
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`, public by design), completely bypassing
this Next.js route. Any unauthenticated caller could do:

```js
supabase.auth.signUp({
  email: 'attacker@example.com', password: '...',
  options: { data: { name: 'x', role: 'admin' } }
});
```

and the trigger would write `role = 'admin'` straight into `agv_profiles` on
account creation, with no approval and no review — full unconditional access
to every table gated on `agv_is_admin()`.

This is a distinct, pre-existing hole in the base signup mechanism itself,
unrelated to the separate `company_id`/`is_company_manager` RLS work
in progress on another branch.

## The fix

Root cause: `raw_user_meta_data` is not a trusted, server-only channel — it's
client-suppliable by design in Supabase Auth, no matter which code path calls
`signUp`/`createUser`. The fix stops the trigger from ever trusting it for
`role`, and moves all legitimate role assignment to explicit, privileged,
server-side writes — the same pattern already used elsewhere in this codebase
for role changes (`src/app/api/admin/set-role/route.ts`: verify caller
identity via the anon client, write via `getSupabaseServiceClient()`).

### 1. Migration: `supabase/migrations/20260805190000_fix_signup_role_injection.sql`

Replaces `agv_handle_new_user()` so it **never reads `role` from
`raw_user_meta_data`** — every new profile is inserted with the hardcoded
safe default `'client'`, this app's least-privileged role. Per
`PRODUCT.md`'s Capabilities and Constraints: client is "read-only, always,
even on granted applications, and only sees activity marked client-visible"
— zero access by design until an admin explicitly grants it. This matches
`signup/route.ts`'s own existing reasoning ("Clients start with zero
application access regardless... the checkpoint that matters is an admin's
manual grant"). `name` is left reading from metadata — it's cosmetic display
text, not an access-control decision, so there is nothing to exploit there.

```sql
insert into public.agv_profiles (id, name, role)
values (
  new.id,
  coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
  'client'
)
on conflict (id) do nothing;
```

This migration was applied to the live (shared dev) Supabase project by the
user between the pre-fix and post-fix verification steps below.

### 2. Every legitimate path updated to do an explicit privileged write

- **`src/app/api/auth/signup/route.ts`** — staff branch: after
  `supabase.auth.signUp(...)` succeeds, added
  `getSupabaseServiceClient().from("agv_profiles").update({ role: "staff" }).eq("id", data.user.id)`.
  The `role: "staff"` still passed in `options.data` is now cosmetic/unused
  for access control — kept only so a reader isn't confused about intent,
  with a comment explaining why it no longer matters.
  Client branch: already used `auth.admin.createUser()` under the
  service_role key, so it already ran with elevated privilege, but it too
  relied on the trigger reading `user_metadata.role`. Added the same
  explicit `update({ role: "client" })` after `createUser()` succeeds — even
  though this happens to match the trigger's own new default, so this path
  doesn't silently depend on that default staying `'client'` if it's ever
  changed.
- **`src/app/auth/callback/route.ts`** (OAuth, PKCE callback) — read in
  full. **No change needed.** It already performs its own explicit
  service-role write —
  `await admin.from("agv_profiles").update({ role }).eq("id", user.id)` —
  immediately after the trigger fires, gated on the `isNewAccount` /
  `NEW_ACCOUNT_WINDOW_MS` check, completely independent of
  `raw_user_meta_data`. This was already the correct pattern before this fix
  and remains unaffected by the vulnerability class described here.
- **`supabase/seed-users.mjs`** — the "update existing account" branch
  already did an explicit `update({ role, name })` via the service-role
  client. The "create new account" branch did not — it relied on the
  trigger reading `user_metadata.role`, which after the fix would leave
  every freshly-seeded dev account as `'client'` regardless of its intended
  role (`admin`/`staff`). Added the same explicit `update({ role })` call
  right after `admin.auth.admin.createUser()` succeeds.
- **`supabase/seed-domain.mjs`** — reviewed; does not create auth users or
  touch `role` at all (seeds applications/documents/activity/access grants
  only). No change needed.

Every write added goes through `getSupabaseServiceClient()` (or, in
`seed-users.mjs`, the equivalent already-service-role `admin` client) — none
rely on the anon client + RLS + trigger metadata.

### What was intentionally left untouched

- `company_id` / `is_company_manager` — separate, in-progress feature on a
  different branch, out of scope here.
- `agv_prevent_self_role_escalation` (own-row UPDATE guard, from
  `20260725100000_prevent_role_escalation.sql`) — a different mechanism
  (blocks self-service UPDATEs), not weakened. This fix is entirely about
  INSERT-time (trigger) role assignment.
- No role VALUES assigned by legitimate paths changed: staff still becomes
  staff for the AGV domain, client still becomes client otherwise — only how
  untrusted metadata is prevented from ever determining the outcome.

## Verification

All tests used real throwaway accounts against the live (shared dev)
Supabase project referenced by this worktree's `.env.local`. Every test
account was deleted via the service-role key afterward and confirmed gone by
re-query (final count: 0 remaining test users, checked by email substring
match across the full `auth.admin.listUsers()` result).

### 1. Baseline: exploit confirmed real, pre-fix (migration not yet applied)

Called `supabase.auth.signUp()` directly with the anon key — bypassing
`/api/auth/signup` entirely, exactly as an external attacker would — with
`options: { data: { name: 'Attacker', role: 'admin' } }`, target email
`avgsectestpreattack20260805@gmail.com`.

Result: `agv_profiles` row created with **`role: "admin"`**. Exploit
confirmed live. Test account deleted immediately after, re-query confirmed
gone.

### 2. Post-fix: same exploit vector, trigger-level equivalent (no email dependency)

The live Supabase project's built-in email service (no custom SMTP
configured) enforces a very low hourly send limit that made repeated
`signUp()`-based retries impractical within the session. Since
`agv_handle_new_user()` fires on **any** INSERT into `auth.users` regardless
of which Auth API created the row, the identical trigger-level exploit
signal was obtained via `auth.admin.createUser()` (service role,
`email_confirm: true`, no email sent) with `user_metadata: { role: 'admin' }`
— this exercises the exact same vulnerable/fixed code path (the trigger),
just via a different (also directly reachable, though privileged-only)
Auth API entry point:

- Email `avgsectestcreateuserattack20260805@gmail.com`,
  `user_metadata.role = 'admin'`.
- Result: `agv_profiles` row created with **`role: "client"`** — not admin.
  Fix confirmed. Account deleted, re-query confirmed gone.

### 3. Legitimate path — client-domain signup (real end-to-end, live app)

Ran the actual Next.js dev server (`npm run dev`, port 3170) and called the
real `/api/auth/signup` route via HTTP:

```
POST /api/auth/signup  { name: "Sec Test Client", email: "avgsectestclient20260805@gmail.com", password: "..." }
```

Response: `{"role":"client", "session": {...}}`. Confirmed directly in
`agv_profiles` via service-role query: `role: "client"`. This path uses
`auth.admin.createUser()` (no email), so it was fully exercised live,
end-to-end, through the real route code. Account deleted, re-query confirmed
gone.

### 4. Legitimate path — staff-domain signup

The real route's staff branch uses `supabase.auth.signUp()`, which sends a
confirmation email — blocked by the same project email-send limit as (2)
above, and compounded by this app's own in-memory per-IP rate limiter in
`/api/auth/signup/route.ts` (`RATE_LIMIT_MAX = 5` / 10 min), which repeated
retries also tripped. Rather than wait out an email-service constraint
unrelated to the fix being verified, obtained equivalent confidence via:

- Direct code inspection confirming the exact explicit-update statement now
  present in the staff branch (see diff above):
  `adminClient.from("agv_profiles").update({ role: "staff" }).eq("id", data.user.id)`.
- A live, email-free exercise of that identical write against the real
  database: created a staff-domain user via `admin.createUser()`
  (`avg-sec-test-staff-explicit-20260805@arteagreenventures.com`,
  `user_metadata.role = 'staff'`, no email sent), confirmed the trigger
  still defaulted the fresh row to `role: "client"` (proving the trigger
  fix applies uniformly, including to staff-domain emails carrying
  `role: "staff"` in metadata), then executed the same
  `update({ role: "staff" }).eq("id", uid)` statement the route performs.
  Result: `role: "staff"`. Confirms the explicit-update mechanism itself
  works correctly against the live DB (permissions, trigger interactions,
  `agv_prevent_self_role_escalation` not blocking a service-role write).
  Account deleted, re-query confirmed gone.

Combined, (3) verifies the real route end-to-end for the client branch, and
(4) verifies the staff branch's explicit-update code is present, correct,
and functions against the live database — the only untested increment is
the email-delivery/confirmation step itself, which is unrelated to the
security fix (it existed before this change and is unaffected by it).

### 5. OAuth path

`src/app/auth/callback/route.ts` was read in full (see "Every legitimate
path updated" above). It already performs its own explicit service-role
`update({ role }).eq("id", user.id)` after the trigger runs, gated on
`isNewAccount`, entirely independent of `raw_user_meta_data`. No code change
was needed, and none was made. Per the task's own guidance, a full live
Azure OAuth round-trip was not attempted (no way to drive it end-to-end in
this environment) — verification here is by code inspection only, which is
sufficient given the mechanism was already correct before this fix and
remains untouched.

### 6. Cleanup confirmation

All test accounts created across every step above were deleted via
`auth.admin.deleteUser()` (service role key). Final re-query of
`auth.admin.listUsers()` filtered by test-account email substrings
(`sec-test`, `sectest`) returned **0 remaining users**. Nothing was left
behind in the shared dev project.

### 7. Build/lint/type checks

- `npx tsc --noEmit` — clean, no errors.
- `npm run lint` — clean, no errors/warnings.
- `npm run build` — succeeded (`✓ Compiled successfully`, all routes
  generated). One pre-existing, unrelated warning about Turbopack not
  supporting AVIF image optimization for a logo asset (`Logo.tsx`) — not
  introduced by this change.

## Round 2: independent review findings and fixes

An independent review of the round-1 fix came back GO overall — the core fix
genuinely closes the hole, race conditions only ever downgrade (never
escalate), and the OAuth path's correctness was confirmed by direct code
reading, not just trusted. It found three Important issues and two cheap
Minor ones, all fixed here:

**1. [Important] Staff branch's UPDATE had no existing-user guard.**
`signUp()` against an email that's already registered doesn't error: with
"Confirm email" on, GoTrue returns an obfuscated user (random id,
`identities: []`) for an already-*confirmed* email (enumeration protection),
but the REAL existing user's id — still with `identities: []` — for an
already-registered-but-*unconfirmed* one. The unconditional
`update({ role: "staff" }).eq("id", data.user.id)` added in round 1 would,
in that second case, silently reset an existing (if unconfirmed) account's
role to `staff`, overwriting whatever an admin had already set — a
route-level write surface that didn't exist pre-fix (the trigger's
`on conflict do nothing` protected existing rows before this fix added any
route-level UPDATE at all).

Fix: `src/app/api/auth/signup/route.ts`'s staff branch now only performs the
UPDATE when `(data.user.identities?.length ?? 0) > 0` — the signal GoTrue
uses to distinguish "just created a brand-new auth.users row" from "returned
an existing user." The client branch needed no equivalent guard:
`admin.createUser()` errors outright on a duplicate email rather than
ambiguously merging, so `createdId` there is always a genuinely new user
(documented inline in the code).

**2. [Important] Migration version collision.** The round-1 migration
filename, `20260805120000_fix_signup_role_injection.sql`, shared its
`20260805120000` version prefix with
`20260805120000_fix_manager_grant_rls_recursion.sql` on the sibling
`companies-access-model` branch — Supabase's `schema_migrations` tracking
keys on that version string, so both branches landing on `main` would
duplicate-key or silently apply only one. Checked every `20260805*`
migration across both branches' directories (highest in use was
`20260805170000` on `companies-access-model`); renamed this migration to
`20260805190000_fix_signup_role_injection.sql`, clearly past that. This was
a pure `git mv` — file content is byte-identical to what's already applied
live (confirmed via `git diff`, shown as a 100%-similarity rename with no
content hunk), so no re-application was needed; only in-repo references to
the old filename (a comment in `seed-users.mjs`, this report) were updated.

**3. [Important] Both new UPDATEs discarded their result.** Neither the
staff nor client branch's role-assignment UPDATE checked for an error or a
zero-rows result — a silently failed write would leave a staff signup
quietly stuck at `client` while still returning a 200 and a valid session,
same failure this fix's own model (`set-role/route.ts`) explicitly guards
against. Both UPDATEs now use `.select("id")` and check
`error || !updated || updated.length === 0`, logging via `console.error` on
failure (with the offending user id and reason) rather than discarding it
silently. Chose to log-and-continue rather than fail the signup outright:
`agv_handle_new_user()`'s own default is already `'client'`
(least-privileged), so a failed role-write leaves the new account
under-privileged, never over — never a security regression, only a
functional one an admin can correct via `/admin/people/roles`, so it isn't
worth blocking a user who already has a valid account and session over.

**4. [Minor] Stale metadata fallback in `src/lib/session.ts`.**
`loadAccount()`'s client-side fallback (used only while the profile row is
momentarily unreadable, e.g. right after the trigger fires) read
`role: profile?.role ?? ((meta.role as Role) ?? "staff")` — reading role from
the same untrustworthy `user_metadata` this whole fix treats as
attacker-controlled, with a stale `"staff"` default from before the
staff/client rename. Not exploitable for data (RLS gates everything
server-side regardless of what this renders), but inconsistent with the
fix's "role never derives from metadata" framing and could render wrong UI
chrome in an edge case. Removed the metadata-role fallback entirely and
changed the bare default to `"client"`, matching the trigger's own default —
the `name` fallback still reads from metadata since that's cosmetic display
text with no access-control implication, same reasoning applied everywhere
else in this fix.

**5. [Minor] Stale comment in `src/app/auth/callback/route.ts`.** The
file-header comment on `agv_handle_new_user()`'s behavior still described
the pre-fix "defaults role to 'staff' unless metadata says otherwise"
behavior. Updated to describe the actual current behavior (always defaults
to `'client'`, never reads metadata for role), with a pointer to the
`20260805190000` migration.

### Round 2 re-verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded, same pre-existing unrelated AVIF warning as
  round 1, no new warnings or errors.
- Re-ran the trigger-level exploit check via `admin.createUser()` with
  `role: 'admin'` metadata (email `avgsectestround2attack20260806@gmail.com`)
  against the renamed/updated code — result: `agv_profiles.role = 'client'`,
  not admin. Fix still holds after the migration rename and route changes.
- Re-ran the client-domain signup path end-to-end through the live dev
  server (`avgsectestclientround220260806@gmail.com`) — response
  `{"role":"client", ...}`, confirmed in `agv_profiles` as `role: "client"`,
  and confirmed via the dev server log that the new error/row-count check on
  that branch's UPDATE passed silently (no `[api/auth/signup]` error logged)
  rather than being untested.
- Verified the new guard's underlying signal by creating a real unconfirmed
  user via `admin.createUser({ email_confirm: false })`
  (`avgsectestunconfirmed20260806@gmail.com`) and inspecting the returned
  `identities` array shape — confirmed non-empty for a genuinely new user,
  consistent with the guard's logic. Could not live-trigger the specific
  "second `signUp()` call against an already-existing-unconfirmed email
  returns real user + empty identities" scenario without tripping the
  project's email-send limit again; that behavior is well-documented
  GoTrue/Supabase behavior and matches the reviewer's own description, which
  the guard code (`identities?.length > 0`) structurally handles correctly
  either way.
- All three round-2 test accounts deleted via service-role key; re-query of
  `auth.admin.listUsers()` confirmed **0 remaining test users** project-wide.
- Race-safety reasoning (a race only ever downgrades, never escalates) and
  the OAuth path's correctness are unaffected by any of these five fixes —
  no code was touched that changes either, confirmed by re-reading the
  diffs.

## Files changed

- `supabase/migrations/20260805190000_fix_signup_role_injection.sql` (new,
  renamed from `20260805120000_...` in round 2 to resolve a version
  collision with a sibling branch — content byte-identical) — the trigger
  fix, applied to the live project by the user during round 1.
- `src/app/api/auth/signup/route.ts` — explicit role UPDATE added to both
  the staff and client branches (round 1); staff branch gated on an
  existing-user guard, both branches' UPDATEs now check for errors/zero-rows
  and log on failure (round 2).
- `supabase/seed-users.mjs` — explicit role UPDATE added to the
  create-new-account branch (round 1); comment updated to the renamed
  migration filename (round 2).
- `src/lib/session.ts` — removed the untrustworthy metadata-role fallback,
  default changed to `"client"` (round 2).
- `src/app/auth/callback/route.ts` — stale comment describing the old
  trigger default corrected (round 2).
