# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Admin and staff at Artea Green Ventures (AGV), an environmental/compliance consultancy operating in Australia and the Philippines, who process environmental-compliance applications day to day: reviewing submissions, changing application stage, logging activity, and granting or revoking each other's access to specific applications.

External client companies who submit applications and need to track their own status and activity without contacting staff directly. Clients are read-only, always, and only ever see their own applications and the activity entries staff have explicitly marked visible to them.

## Product Purpose

A role-based portal that lets AGV run environmental-compliance applications end to end — submission through to final report — in one system, instead of over email or spreadsheets. Success looks like: staff can see and act only on the applications they've been granted, admins have full oversight, and clients get transparent self-service visibility into their own application's status and history without staff having to manually relay updates.

## Positioning

Access to an application is a per-application grant with a lifecycle (`granted_at` / nullable `revoked_at`), not a role-wide permission — a staff member's access is scoped application-by-application and fully revocable/auditable, re-granting inserts a new grant rather than reviving an old one. Client visibility into activity is opt-in per entry (`visible_to_client`), so staff choose what a client sees rather than exposing the full internal log. All three role boundaries (admin/staff/client) are enforced server-side via Postgres RLS, not just hidden in the UI.

## Operating Context

Real Supabase-backed production app (Postgres, Auth with MFA, RLS, Storage) — not a mocked demo, despite what the repo's top-level README still says; that file is stale and should be updated separately. Deployed live at `https://portal.arteagreenventures.com` (Vercel, custom subdomain via Wix CNAME). Core workflows: application submission and staff/admin processing (stage changes, activity notes), per-application access grant/revoke between admin and staff, a People area (Directory, Access, Activity) for managing who has access to what, and an Account Settings area covering password change and MFA enrollment.

## Capabilities and Constraints

Three roles — `admin` (full unconditional access), `staff` (access only to applications they've been granted), `client` (read-only, always, even on granted applications, and only sees activity marked client-visible). Built on Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (`radix-vega` preset) plus Kokonut UI as a secondary component registry, Supabase (`@supabase/ssr`), `motion`, `sonner`, and `zustand`.

## Brand Commitments

Name: Artea Green Ventures (AGV). Real logo asset in use (`public/images/Artea Logo Assets-09-black.png`; the app favicon is a cropped/alpha-matted version of the same lockup — AGV lettering plus the tree mark together, not the tree alone). No aesthetic direction, palette, or typography is recorded here — that belongs in DESIGN.md.

## Evidence on Hand

Real AGV brand asset (logo file above) used for the favicon. Live production deployment at the custom domain above, verified serving over HTTPS with a valid certificate. No fabricated testimonials, case studies, or pricing exist in the product — none should be added.

## Product Principles

- Access is a per-application, auditable grant — never a role-wide permission.
- Client visibility into activity is opt-in per entry; staff decide what's shared, not the system by default.
- Role boundaries are enforced server-side (RLS), never trusted to the UI alone.
- Revoking access preserves history (sets `revoked_at`, never deletes the grant row).

## Accessibility & Inclusion

No formally stated accessibility requirement from the client, but WCAG AA color contrast and full keyboard operability (tab order, accessible names on interactive controls, focus-visible tooltips) are maintained as a working standard and checked on every UI change — treat that as the floor for new work, not an optional nicety.
