# AGV Field Portal

Role-based compliance-tracking portal demo for **Artea Green Ventures** — an
environmental/compliance consultancy operating in Australia and the
Philippines. Design/portfolio build: all auth, data and persistence are
mocked. Nothing here talks to a real backend.

## Run

```bash
npm install
npm run dev   # → http://localhost:3170
```

## Demo accounts (any password)

| Role | Email | Sees |
|---|---|---|
| Admin | `admin@agv-demo.com` | All applications, status controls, analytics |
| Client | `client@agv-demo.com` | Their own application only |

A one-click quick-switch in the header toggles roles instantly.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · Zustand

Build progress lives in [STATUS.md](./STATUS.md).
