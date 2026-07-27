# AGV Portal — Status
Updated: 2026-07-27
Phase: xms_edov verification for Microsoft OAuth
State: Complete. Staff-role assignment via Microsoft OAuth now requires both a matching email domain AND Azure's xms_edov claim confirming that domain is actually verified — not just self-reported. Verified against a real login for the success path; the rejection path is verified by code trace only (see Known issues for why a live spoof isn't constructible here).

## Done this session

### Step 1 — investigated before building (per the task's own instruction)
Checked whether Supabase surfaces `xms_edov` at all before assuming an approach:
- First checked a real, already-existing Azure-authenticated user (`jonas@arteagreenventures.com`, logged in before this session) via the Admin API. Its `user_metadata.custom_claims` contained only `{ email, tid }` — no generic pass-through of ID-token claims, just a curated set GoTrue's Azure provider extracts. `xms_edov` wasn't there, but it also wasn't being issued by Azure yet at that point, so this alone didn't answer the question.
- Added temporary probe logging in `auth/callback/route.ts` to capture `user_metadata.custom_claims` and check for a raw provider ID token via `session.provider_token` (in case a fallback to manual JWT decoding was needed).
- After adding `xms_edov` as an ID-token optional claim in Azure (Token configuration — hit the documented "claim is invalid" UI warning, which is a known, safe-to-ignore Azure Portal bug) and doing one more real login: **`user_metadata.custom_claims.xms_edov` came through as `true`.** Confirmed empirically, not assumed. This meant the manual-JWT-decode fallback plan wasn't needed — Supabase already surfaces it in the same place as the other custom claims.
- Removed the temporary probe logging once this was confirmed.

### Step 2 — Azure configuration (user-side)
`xms_edov` added as an ID-token optional claim in the app registration's Token configuration, same place as `email`. Confirmed working via the real login above.

### Step 3 — verification logic
`src/app/auth/callback/route.ts`, inside the existing `isNewAccount` branch (same point the domain check already happened):
- If the email domain matches `arteagreenventures.com`, additionally require `user.user_metadata?.custom_claims?.xms_edov === true`.
- Any other value — `false`, missing entirely, `undefined` — is treated as unverified. The check is a strict `=== true` comparison, so absence and explicit-false both fail the same way; there's no separate "unknown" branch that defaults to trusting it.
- On failure: the just-created account is deleted via the service-role client (`admin.auth.admin.deleteUser`), and the response redirects to `/?error=oauth_unverified_domain` — deliberately a **fresh** `NextResponse.redirect`, not the `response` object exchangeCodeForSession had already staged Set-Cookie headers onto, so the about-to-be-deleted account's session cookie never reaches the browser at all.
- Non-AGV-domain sign-ins are completely untouched — the whole check is inside the `domainMatches` branch, so a personal/other-company Microsoft account still resolves to `client` exactly as before.
- `src/app/page.tsx` — added a specific error message for `?error=oauth_unverified_domain` (distinct from the generic `?error=oauth`), directing the person to sign up with email/password instead.
- Kept the diagnostic `console.error` logging pattern (per the task's instruction) on the rejection path — logs the email and the raw `custom_claims` object, so a future case that hits this is diagnosable the same way the earlier Azure setup failures were.

## Files added/changed
- `src/app/auth/callback/route.ts` — xms_edov check added inside the existing domain-match branch; temporary probe logging added then removed.
- `src/app/page.tsx` — new specific error copy for the unverified-domain rejection case.

## Decisions made
- Fail closed: absence of the claim is treated identically to an explicit `false`. This was a hard requirement from the task, not a judgment call, but worth restating since it's the one place a "helpful" default (assume verified if the claim just isn't in the payload for some reason) would have quietly reopened the exact gap this task closes.
- Rejection deletes the account rather than creating it with `client` role or leaving it in a pending state, matching the task's instruction to keep this simple: OAuth-based staff assignment either has proof, or it doesn't happen via OAuth at all.
- Returned a fresh `NextResponse.redirect` rather than reusing the cookie-laden `response` on the rejection path, specifically so a session for an account being deleted in the same request can never reach the browser.
- The check only ever runs on first-ever login (inside the existing `isNewAccount` gate) — consistent with the existing role-assignment design, and out of scope to change here.

## Known issues / TODO
- **Found, not part of this task, flagged separately**: the account used for live verification here (`jonas@arteagreenventures.com`) turned out to be a *second*, separate `auth.users` row for the same email as an earlier test login from initial Azure setup — same Microsoft `sub` both times, but the original row has no `agv_profiles` row at all (orphaned, likely left behind by one of the mid-debugging failures during initial Azure wiring). The newer row (used for this verification) is the one that's actually correct and working. Not cleaned up yet — asking before deleting a real auth account. See Blocked on.
- **Honest coverage gap, not fixable without infrastructure this session doesn't have**: the rejection path (domain matches, `xms_edov` false/missing) is verified by direct code trace against the exact real data shape observed above, not against an actual live spoofed login. Constructing a genuine test would need a second Azure AD tenant configured to assign a user a `mail` attribute of `...@arteagreenventures.com` without owning that domain — which is the actual mechanism the real nOAuth vulnerability class exploits (a mismatch between a verified UPN/tenant domain and a freely-settable `mail` attribute), not something achievable by testing against AGV's own real, legitimately-owned tenant. This wasn't skipped — it isn't constructible in this environment. The logic itself (`=== true`, so any other value fails) is simple enough that this trace is a reasonable substitute for a live test.
- **Pre-existing, unrelated to xms_edov**: no real end-to-end Microsoft OAuth login has ever been tested for the *client* path (a personal or non-AGV-organization Microsoft account) — every live OAuth test so far, across this whole project, has used the AGV staff account. The client path has only been verified by code trace. Not required for this task, but worth knowing before calling the client-OAuth story fully proven.

## Blocked on / needs a decision
Whether to delete the orphaned duplicate `auth.users` row (no `agv_profiles` row, same email as the working account) found while verifying this — it looks clearly broken/dead, but it's a real account deletion on production data, so asking rather than doing it unilaterally.

## Next step
User decides on the orphaned-account cleanup. Otherwise this task is complete — no further xms_edov work pending. Google OAuth (Batch C's other half) is still separately pending from before this task, unaffected by anything here.
