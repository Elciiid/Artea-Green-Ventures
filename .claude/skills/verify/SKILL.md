---
name: verify
description: How to build, run, and drive the AGV Portal demo for verification
---

# Verifying AGV Portal

Design/portfolio demo — all auth and data are mocked (Zustand + localStorage, key `agv-demo-session`). No backend.

## Build / run

```bash
npm run build        # typecheck + prod build, ~10s
npm run dev          # dev server on http://localhost:3170
```

From the E:\Claude\Local session, a launch.json entry named `agv-portal` starts the dev server via `npm --prefix E:/Work/Code/AVG-Portal run dev` (port 3170).

## Flows worth driving

1. Login `/` — one-click rows ("Admin console" / "Client portal") sign in instantly. Manual form: `admin@agv-demo.com` or `client@agv-demo.com`, any password; unknown email shows inline `role="alert"` error.
2. Role guard — visiting `/admin` as client bounces to `/portal` (and vice versa); signed out → `/`.
3. Quick switch — header "⇄ View as …" toggles role and routes to the other home.
4. Session persists across full reload (localStorage).
5. Mobile 375px — check `document.documentElement.scrollWidth <= clientWidth` on `/`, `/admin`, `/portal`.

## Gotchas

- Browser-pane screenshots can wedge (30s timeouts) while JS eval keeps working — verify state via `javascript_tool` reading `window.location.pathname`, `document.title`, and the `agv-demo-session` localStorage key instead.
- Header buttons sit at identical coordinates on /admin and /portal — a double-dispatched click can toggle the role twice and look like a no-op. Confirm outcomes via localStorage, not clicks alone.
