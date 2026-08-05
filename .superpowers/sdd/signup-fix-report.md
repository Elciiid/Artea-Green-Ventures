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

### 1. Migration: `supabase/migrations/20260805120000_fix_signup_role_injection.sql`

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

## Files changed

- `supabase/migrations/20260805120000_fix_signup_role_injection.sql` (new) —
  the trigger fix, applied to the live project by the user during this
  session.
- `src/app/api/auth/signup/route.ts` — explicit role UPDATE added to both
  the staff and client branches.
- `supabase/seed-users.mjs` — explicit role UPDATE added to the
  create-new-account branch.
