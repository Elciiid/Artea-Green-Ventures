# AGV Portal — Status
Updated: 2026-07-24
Phase: Auth hardening — OAuth, CAPTCHA, rate limits, headers
State: In progress. Split into three batches given how much of this depends on external, user-only setup (Azure/Google console work, Supabase dashboard toggles). **Batch A (security headers, dependency audit, rate-limit recommendations) is complete.** Batch B (Turnstile CAPTCHA) is waiting on a site key from you. Batch C (Azure/Google OAuth) is waiting on your app registrations.

## Done this session (Batch A)

**Security headers**, added at the Next.js `next.config.ts` layer via `headers()` — applies to every route:
- `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Deliberately used the plain `headers()` approach rather than Next's nonce-based CSP pattern (`proxy.ts` in Next 16 — the renamed `middleware.ts`) — nonces require **every page** in the app to opt into dynamic rendering just to carry the header, which would mean touching nearly every route and giving up static optimization app-wide. That's a much bigger, more invasive change than "add security headers," and this project's standing rule is to preserve everything else untouched.
- Trade-off, disclosed rather than silent: `script-src`/`style-src` both need `'unsafe-inline'` under this approach (style-src needs it regardless, for Framer Motion's runtime inline styles, independent of the nonce question).
- `challenges.cloudflare.com` is pre-allowed in `script-src`/`connect-src`/`frame-src` ahead of the still-pending Turnstile integration (Batch B), so this file won't need touching again when that lands.
- **Verified live**: all 5 headers present via curl; zero CSP violations in the browser console through a real admin sign-in (password auth, redirect, Supabase connectivity); confirmed a Framer Motion inline `style` attribute rendered and applied correctly under this CSP.

**Dependency audit** (`npm audit`):
- Found 3 high-severity findings: one in `next` itself, and two nested inside `next`'s own bundled dependencies (`postcss`, `sharp`).
- Applied the one safe, non-breaking fix available: bumped `next` 16.2.10 → 16.2.11 (within the existing `^16.1.0` range). Rebuilt, re-linted, re-typechecked — all clean.
- **The remaining 3 findings have no safe fix right now.** `npm audit fix --force` would downgrade to `next@9.3.3` — a pre-App-Router release from years before this app was built, which would break essentially everything. Not applying that. Checked whether this app is actually exposed to the underlying CVEs: most of them target Server Actions, custom servers, SVG-based `next/image` optimization, i18n locale routing, or `rewrites()` — this app uses **none** of those (no `"use server"` anywhere, no custom server, no SVGs through `next/image`, no locale routing, no `rewrites()` in `next.config.ts`). The one that isn't ruled out by feature usage is a generic "cache confusion of response bodies" issue in Next's core request handling. Worth re-running `npm audit` before each future deploy until Next.js ships a stable release with these patched — no action needed today beyond that habit.

**Rate-limit recommendations** (Supabase Dashboard → Authentication → Rate Limits — I can't set these myself, this is what to enter):

| Setting | Governs | Current default | Recommended | Why |
|---|---|---|---|---|
| Token Requests | Both password sign-in **and** token refresh — they're the same `/auth/v1/token` endpoint, different grant types, not two separate knobs | 1800/hour | **300/hour** | ~6x cut from default. Still comfortable headroom for this app's real scale (background token refresh + normal logins across staff and clients), while meaningfully raising the bar against scripted brute-force sign-in attempts. |
| MFA Challenge & Verify | TOTP code verification | 15/minute | Leave as-is | A 6-digit TOTP code only stays valid ~30 seconds — that rotation, not the rate limit, is the real defense here. Default is already reasonable; tightening it further has little practical benefit. |
| Anonymous sign-ins / signup endpoint | Possibly **all** `/auth/v1/signup` traffic, not just Supabase's anonymous-auth feature — email/password `signUp()` (our real staff signup path) hits the same endpoint under the hood | 30/hour | **Check this one in your dashboard before touching it** — genuine ambiguity in Supabase's own docs about whether it's anonymous-only or covers real signups too. Don't drop it below whatever real staff onboarding volume you expect, since it may gate that too. |
| OTP/magic link, signup confirmation, password reset, "endpoints that trigger email sends" | Anything that sends an email | 30/hr, 60s window, 60s window, **2 emails/hour** | Leave untouched | Out of scope per this pass's hard constraint — the 2-emails/hour cap on the built-in mailer is already the real bottleneck regardless of what these say. |

## Files added/changed
- `next.config.ts` — security headers via `headers()`.
- `package-lock.json` — `next` 16.2.10 → 16.2.11 (patch bump, `npm audit fix`).

## Decisions made
- Split this phase into three batches (Batch A done now; B needs a Turnstile site key from you; C needs your Azure/Google app registrations) rather than attempt everything in one pass, per this project's standing invitation to split large phases.
- Chose Cloudflare Turnstile over hCaptcha for Batch B (your call, confirmed).
- Config-based CSP over nonce-based, accepting `'unsafe-inline'` on two directives, to avoid forcing the entire app into dynamic rendering (see above).
- Did not force-fix the 3 remaining `npm audit` findings — the only available "fix" is a breaking, years-old Next.js downgrade that would do far more damage than the (mostly inapplicable) vulnerabilities themselves.

## Known issues / TODO
- Re-run `npm audit` periodically (e.g. before each deploy) until Next.js ships a stable release patching the 3 remaining findings.
- Confirm what the "Anonymous sign-ins" rate limit actually governs in your specific project before changing it.

## Blocked on / needs a decision
- **Batch B (CAPTCHA)**: needs a Cloudflare Turnstile site key from you (create a widget in the Cloudflare dashboard; the secret key goes only into Supabase's dashboard under Authentication → Attack Protection, never here).
- **Batch C (OAuth)**: needs your Azure app registration (single-tenant, AGV's Entra ID tenant) and Google Cloud Console OAuth app, each configured with their credentials directly in Supabase's dashboard, before I can wire up and test either sign-in path.

## Next step
Apply the rate-limit table above in Supabase's dashboard whenever convenient — low risk, no code dependency. Send over the Turnstile site key when you have it and I'll start Batch B. Let me know once your Azure and/or Google app registrations are done and I'll start Batch C.
