# AGV Portal — Status
Updated: 2026-07-25
Phase: CAPTCHA protection — signup + sign-in
State: Complete.

## Done this session
- Provider: **Cloudflare Turnstile** (your call from the prior session, confirmed) — Supabase's Attack Protection panel supports Turnstile or hCaptcha natively; Turnstile is Cloudflare's own widget and the more commonly recommended default of the two.
- You created the Turnstile widget, enabled Captcha Protection in Supabase's Auth settings with the secret key, and handed me the site key — never pasted the secret into this chat, same boundary as every other credential in this project.
- Built a shared `Turnstile` component (`src/components/Turnstile.tsx`) — loads Cloudflare's script once in explicit-render mode, renders into a ref'd container, reports the resulting token via `onVerify`/`onExpire`. No npm package added; Cloudflare's own script exposes `window.turnstile`.
- `next.config.ts` CSP already had `challenges.cloudflare.com` pre-allowed in `script-src`/`connect-src`/`frame-src` from the Batch A headers work, so no header changes were needed this session.
- Wired the widget into **both** entry points:
  - `/signup` (`src/app/signup/page.tsx`) — token required before submit enables; sent as `turnstileToken` in the POST body to `/api/auth/signup`.
  - Sign-in (`src/app/page.tsx`) — token required before submit enables; passed into `signInWithPassword({ options: { captchaToken } })`.
- `/api/auth/signup` (`src/app/api/auth/signup/route.ts`) already handled both the staff branch (`signUp()` with `captchaToken`) and the client branch (Admin API `createUser()`, which structurally can't carry a CAPTCHA token, followed immediately by a `signInWithPassword()` call that both verifies the same token and rolls the account back — `deleteUser()` — on any failure). No app code changes needed on the route itself; it was already built for this from the widget-plumbing session.
- **Environment issue mid-session**: Claude Desktop's embedded Browser pane was found to crash Cloudflare Turnstile into an infinite verification loop that corrupts the app's local install state (isolated to that embedded browser, not the codebase). Stopped using it immediately for any CAPTCHA-rendering page and switched to the verification approach below. No project files or Supabase state were affected — the passive page load that triggered the concern was a `read_page` only, no click, and the preview server was stopped right after.

## Verification
Ran the dev server headlessly (`npm run dev`, no browser attached) and hit both Supabase's Auth API directly and this app's own `/api/auth/signup` route with curl — no-token and invalid-token cases, both branches.

**1) Supabase Auth API directly** (`/auth/v1/token?grant_type=password` and `/auth/v1/signup`):
```
=== signInWithPassword, NO captcha token ===
HTTP 400
{"code":400,"error_code":"captcha_failed","msg":"captcha protection: request disallowed (no captcha_token found)"}

=== signInWithPassword, INVALID captcha token ===
HTTP 400
{"code":400,"error_code":"captcha_failed","msg":"captcha protection: request disallowed (invalid-input-response)"}

=== signUp, NO captcha token ===
HTTP 400
{"code":400,"error_code":"captcha_failed","msg":"captcha protection: request disallowed (no captcha_token found)"}

=== signUp, INVALID captcha token ===
HTTP 400
{"code":400,"error_code":"captcha_failed","msg":"captcha protection: request disallowed (invalid-input-response)"}
```

**2) This app's `/api/auth/signup` route**, both branches:
```
=== STAFF branch, NO turnstileToken ===
HTTP 400
{"error":"Complete the verification challenge."}

=== STAFF branch, INVALID turnstileToken ===
HTTP 400
{"error":"captcha protection: request disallowed (invalid-input-response)"}

=== CLIENT branch, NO turnstileToken ===
HTTP 400
{"error":"Complete the verification challenge."}

=== CLIENT branch, INVALID turnstileToken ===
HTTP 400
{"error":"Complete the verification challenge."}
```

**3) Rollback check** — for the client-branch invalid-token case (the one that unavoidably calls `admin.createUser()` before the token is checked), queried Supabase's admin users list afterward: the test email never appears. Rollback deletes the account on CAPTCHA failure exactly as designed — no orphaned accounts from any of the four rejected attempts.

**Widget rendering/human-completion**: not verified by me this session, per your instruction to keep that check out of Desktop's embedded browser. The widget code is the same shared component on both pages and Cloudflare's script loads under the existing CSP allowlist — worth a quick manual check in a regular Chrome/Edge/Firefox window on your end (fill the form, confirm the widget completes and the button un-disables) to close the loop on that specific property.

## Files added/changed
- `src/components/Turnstile.tsx` — new shared widget component (from prior session, unchanged this session).
- `src/app/signup/page.tsx` — Turnstile wired in, `turnstileToken` gate on submit.
- `src/app/page.tsx` — Turnstile wired in, `turnstileToken` gate on submit, CAPTCHA-specific error copy.
- `src/app/api/auth/signup/route.ts` — no changes this session (already handled both branches).
- `STATUS.md` — this file.

## Decisions made
- Turnstile over hCaptcha (confirmed prior session).
- Verified server-side enforcement via curl instead of Desktop's Browser pane, after the environment issue — this is the more rigorous test for "bots get blocked" anyway, since it doesn't depend on the widget rendering correctly to prove the actual security property.
- Left human-completion/render verification to you in an external browser, per your explicit instruction.

## Known issues / TODO
- Human-completion check (widget renders, real person can pass it) still needs a manual pass in a real Chrome/Edge/Firefox window — see Verification section above.
- Do not use Claude Desktop's embedded Browser pane to preview `/signup` or `/` (sign-in) until Cloudflare/Anthropic resolve whatever causes the Turnstile-triggered crash loop — flagged here so it isn't rediscovered the hard way in a future session.

## Blocked on / needs a decision
Nothing — this batch is complete. OAuth (Batch C) and the rate-limit table (from Batch A) are still open in the broader auth-hardening thread, out of scope for this prompt.

## Next step
Do the manual human-completion check in a regular browser when convenient. Let me know when your Azure/Google app registrations are ready and I'll pick up Batch C (OAuth), or send the word to resume rate-limit changes in the Supabase dashboard.
