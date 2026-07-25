# AGV Portal — Status
Updated: 2026-07-25
Phase: Auth hardening — CAPTCHA parked, proceeding with OAuth / rate limits / headers / dependency audit
State: CAPTCHA cleanly backed out. App verified clean and working without it. Ready to resume the rest of the auth-hardening scope.

## Done this session
- **Backed out the Turnstile CAPTCHA integration** built in the prior session (Batch B). Not cancelled — parked, because local testing kept crashing Claude Desktop's embedded Browser pane against a real Turnstile challenge even after the previous session routed verification through curl instead of the browser. Rather than keep losing time to that tooling issue, removed it cleanly so the rest of the auth-hardening pass (OAuth, rate limits, headers, dependency audit — none of which depend on CAPTCHA) can proceed.
- **Nothing was uncommitted going into this** — the prior session's CAPTCHA work was already fully committed (`8002ebc`, `6c84cf0`, `b2481f1`, plus the `13a8164` STATUS.md update), so the "commit first" step was a no-op by the time this one started. That history is exactly where this work is recoverable from if/when CAPTCHA comes back into scope.
- **Removed from the live tree** (commit `e0734b6`):
  - `src/components/Turnstile.tsx` — the shared widget component, deleted outright.
  - `src/app/signup/page.tsx` — `turnstileToken` state, the widget render, the submit gate, and `turnstileToken` in the POST body.
  - `src/app/page.tsx` (sign-in) — same pattern: token state, widget render, submit gate, and the CAPTCHA-specific error-copy branch.
  - `src/lib/session.ts` — `signIn()` reverted to `(email, password)`, no `captchaToken` param; header comment's CAPTCHA justification for removing quick-switch login reworded (the removal itself still stands — the underlying problem was zero-human-interaction auth, not CAPTCHA specifically).
  - `src/app/api/auth/signup/route.ts` — `turnstileToken` removed from the request body, the "complete the challenge" validation gate, `captchaToken` from the staff branch's `signUp()` call, and `captchaToken` from the client branch's post-creation `signInWithPassword()` call. Kept the client branch's create-then-sign-in-then-rollback shape as-is, since that pattern exists independently of CAPTCHA — `createUser()` doesn't return a session, so signing in immediately (and rolling back on failure) is how the browser gets a session either way. Only the CAPTCHA-specific token and the CAPTCHA-flavored error message came out.
  - `.env.example` and `.env.local` — `NEXT_PUBLIC_TURNSTILE_SITE_KEY` removed from both.
- **Left alone, on purpose** (per this task's own hard constraints): `next.config.ts`'s CSP still allows `challenges.cloudflare.com` in `script-src`/`connect-src`/`frame-src` — that's headers-track work (Batch A), out of scope here, and an unused CSP allowance isn't a functional problem. Also left `supabase/config.toml`'s commented-out `[auth.captcha]` block untouched — that's Supabase's own CLI scaffold template for self-hosting, predates this project's CAPTCHA work entirely, and was never something we added.
- **Supabase's Captcha Protection setting**: confirmed already disabled — see Verification below. Nothing further needed there.

## Verification
- `grep -riE "turnstile|captcha"` across the repo (excluding `STATUS.md`, which is history/documentation): only the two intentionally-preserved references above remain. No dangling code references anywhere.
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds (the one warning is a pre-existing, unrelated AVIF-image note, not CAPTCHA-related).
- **End-to-end, headless** (`npm run dev`, no browser attached, all via curl):
  - Confirmed Supabase's Captcha Protection is currently off: a bogus-credentials sign-in attempt against Supabase's Auth API directly returns `invalid_credentials`, not `captcha_failed` — meaning no leftover server-side requirement would break signup/sign-in now that the frontend no longer sends a token.
  - Ran a real signup through `/api/auth/signup` for both branches: staff (`@arteagreenventures.com`) returned `{"pendingConfirmation":true}` as expected (email confirmation, unrelated to CAPTCHA); client (any other domain) returned `HTTP 200` with a live session, no token required anywhere in the request.
  - Signed in as the newly created client account directly against Supabase's Auth API (mirrors what `session.ts`'s `signIn()` now does) — `HTTP 200`, valid session back.
  - Deleted both test accounts afterward via the Admin API; nothing test-related left behind in the project.

## Files added/changed
- `src/components/Turnstile.tsx` — deleted.
- `src/app/signup/page.tsx`, `src/app/page.tsx`, `src/lib/session.ts`, `src/app/api/auth/signup/route.ts`, `.env.example` — CAPTCHA wiring stripped.
- `.env.local` — site-key line removed (gitignored, not part of the commit).
- `STATUS.md` — this entry.

## Decisions made
- Parked rather than deleted-from-history: everything is one `git revert`/checkout away from `e0734b6`'s parent if CAPTCHA comes back into scope, since the prior session's build-out is intact in earlier commits.
- Kept the client-signup branch's create→sign-in→rollback shape rather than simplifying it further, since that structure serves a real non-CAPTCHA purpose (session bootstrapping after an Admin API creation call that returns no session).

## Known issues / TODO
None outstanding for CAPTCHA specifically. The Desktop Browser pane / Turnstile crash issue is now moot for this codebase since no page renders a Turnstile widget anymore — but worth remembering if CAPTCHA is reintroduced later, since the underlying tooling issue itself wasn't resolved, just avoided by removing the trigger.

## Blocked on / needs a decision
Nothing. Clear to proceed.

## Next step
Move on to the rest of the auth-hardening scope — OAuth (needs your Azure/Google app registrations), the rate-limit table from Batch A (needs you to apply it in the Supabase dashboard), and the dependency-audit follow-up (re-run `npm audit` before deploy until Next.js patches the remaining findings). Let me know which to pick up first, or if you'd like all three proceeding in whatever order fits your available time.
