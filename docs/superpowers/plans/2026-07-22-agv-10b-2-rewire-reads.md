# AGV Portal 10b-2 — Rewire Reads to Real Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Zustand/mock-store reads in `ApplicationRegister`'s two consumers (`AdminDashboard`, `UserPortalView`) and the two application-detail views (`AdminApplicationView`, `UserApplicationView`) with real Supabase queries against `agv_applications` / `agv_documents` / `agv_activity_entries`, filtered through RLS (proven in 10b-1) instead of client-side visibility logic — with proper async loading/error states, and zero visual regression against Phase 16.

**Architecture:** A new `src/lib/supabase/applications.ts` module owns two functions — `fetchApplications()` and `fetchApplicationByReference()` — that query Supabase directly and map DB rows onto the existing `Application`/`DocumentItem`/`TimelineEntry` shapes from `src/lib/mock-data.ts`. RLS does the access filtering server-side, so `fetchApplications()` runs the *same* query for admin and non-admin callers; the row set Postgres returns is already correctly scoped. The four consuming components become async: `useState` + `useEffect` around the fetch, each with its own `loading` / `error` / (`not-found` | `blocked`) / `ready` states, re-fetching whenever the signed-in account identity changes (the dev QuickSwitch can move between two accounts on the same route without a navigation event). `ApplicationDetail` stops reading the mock store directly and instead calls `onStageChange` / `onAddNote` callback props, so the admin edit UI keeps working exactly as before but its two callers now own where the mutation goes.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@supabase/supabase-js` (already the browser client from `src/lib/supabase/client.ts`, Phase 10a), Tailwind v4 utility classes matching the existing design tokens.

## Global Constraints

- Preserve Phase 16's visual output pixel-for-pixel for every state that already existed (register table, ruled `ApplicationDetail` document, not-found/blocked-access copy). Only *new* states (loading, generic error) may introduce new markup, and it must visually match the existing institutional register language (same `border-y-2 border-bone/80` framing, same spinner already used in `AppShell.tsx`'s hydration gate).
- Preserve Phase 10a/10c completely: real Supabase Auth, `/account` (password + MFA), sidebar navigation, display preferences. None of those files are touched by this plan.
- Do not touch the `clientName` field's meaning or shape on `Application` records — map `client_name` straight through, no renaming.
- US spelling; dates render through the existing `formatDate()` ("Jun 18, 2026") — do not introduce a second date formatter.
- **No writes to Supabase in this slice.** The admin "change status" / "add note" controls stay wired up (removing them would be a Phase 16 regression) but their effect is local React state only, discarded on refresh, until 10b-3 makes them real.
- **No automated test suite exists in this repo** (no vitest/jest/playwright, confirmed via `package.json`). Every task's verification step is either `npm run lint`, `node --check <file>` (syntax-only, for the seed script this plan can't execute — it needs a `service_role` key that must never enter this session), or a manual check via the Claude Browser tool against the real running dev server (`npm run dev`, port 3170) — matching this project's own established practice of empirical, browser-based verification (see 10a's MFA cycle, 10b-1's RLS proof).
- `/admin/access` (`AccessMatrix.tsx`) and `AppShell.tsx`'s "Reset demo data" button are deliberately **left untouched** — they still operate on the mock `useApplications` store, which remains correct for that still-mock-backed page until 10b-3 rewires it too.

---

## File Structure

- **Create** `src/lib/supabase/applications.ts` — the Supabase query + row-mapping layer. Owns `fetchApplications()` and `fetchApplicationByReference()`.
- **Create** `src/components/RegisterStatus.tsx` — shared loading/error placeholder for the two register views, visually matching `ApplicationRegister`'s header.
- **Modify** `supabase/seed-domain.mjs` — stagger `created_at` on document rows so a later `ORDER BY created_at` reproduces the exact original (non-chronological) document order from `mock-data.ts`.
- **Modify** `src/components/admin/AdminDashboard.tsx` — async fetch via `fetchApplications()`.
- **Modify** `src/components/UserPortalView.tsx` — async fetch via `fetchApplications()`; drops the now-redundant client-side `visibleApplicationsFor` filtering.
- **Modify** `src/components/ApplicationDetail.tsx` — replace direct `useApplications` store calls with `onStageChange` / `onAddNote` callback props. No DOM/visual change.
- **Modify** `src/components/admin/AdminApplicationView.tsx` — async fetch via `fetchApplicationByReference()`; owns the local-only edit-state shim.
- **Modify** `src/components/UserApplicationView.tsx` — async fetch via `fetchApplicationByReference()`; drops the now-redundant `isApplicationVisible` check (RLS already returns `null` for anything ungranted).
- **Modify** `src/app/admin/applications/[id]/page.tsx` — remove `generateStaticParams` (was sourced from mock data, now stale by construction); simplify `generateMetadata`.
- **Modify** `src/app/portal/applications/[id]/page.tsx` — same.

---

## Task 1: Stable document ordering in the seed script

The register/detail pages will soon read `agv_documents` ordered by `created_at`, but the current seed inserts every application's documents in a single batch `upsert`, so Postgres's `now()` default is evaluated once per statement — every row in a batch gets an **identical** `created_at`, making `ORDER BY created_at` non-deterministic. The documents also aren't in chronological order in `mock-data.ts` (they're grouped by category, not upload date — e.g. `AGV-2026-0142`'s docs are EIS Addendum → Noise & Vibration → Groundwater → Site Access, not date-ascending), so sorting by `uploaded_at` instead would silently reorder that one application's document list. This task staggers `created_at` by array index so ordering is stable and reproduces the exact original order.

**Files:**
- Modify: `supabase/seed-domain.mjs:167-177`

**Interfaces:**
- Consumes: nothing new.
- Produces: `agv_documents.created_at` values that strictly increase in the same order as each application's `documents` array in this file — later tasks' `ORDER BY created_at ascending` relies on this.

- [ ] **Step 1: Edit the `docRows` mapping**

In `supabase/seed-domain.mjs`, replace:

```js
    const docRows = documents.map((d) => ({
      id: uuid5(`${app.reference}:doc:${d.name}`),
      application_id: appId,
      name: d.name,
      kind: d.kind,
      storage_path: null, // real files land in slice 10b-3
      size_label: d.size_label,
      status: d.status,
      uploaded_by: null,
      uploaded_at: d.uploaded ? noon(d.uploaded) : null,
    }));
```

with:

```js
    const docRows = documents.map((d, i) => ({
      id: uuid5(`${app.reference}:doc:${d.name}`),
      application_id: appId,
      name: d.name,
      kind: d.kind,
      storage_path: null, // real files land in slice 10b-3
      size_label: d.size_label,
      status: d.status,
      uploaded_by: null,
      uploaded_at: d.uploaded ? noon(d.uploaded) : null,
      // Documents aren't chronological in this list (grouped by category, not
      // upload date), and every row in one upsert batch gets the same
      // default now() — stagger created_at by index so ORDER BY created_at
      // reproduces this exact array order. Phase 10b-2.
      created_at: new Date(Date.parse(noon(app.submitted_at)) + i * 1000).toISOString(),
    }));
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check supabase/seed-domain.mjs`
Expected: no output, exit code 0 (this only checks JS syntax — it does not connect to Supabase or require any credentials).

- [ ] **Step 3: Ask the user to re-run the seed in their own terminal**

This plan cannot run the seed itself — it needs `SUPABASE_SERVICE_ROLE_KEY`, which must never enter this session (standing project rule). Tell the user:

```bash
node supabase/seed-domain.mjs
```

with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in their own shell. It's idempotent (upserts by deterministic id), so re-running is safe. This can happen any time before Task 10 (final browser verification) — it doesn't block Tasks 2–9, which are pure code changes.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed-domain.mjs
git commit -m "Stagger seeded document created_at so document order is reproducible"
```

---

## Task 2: Supabase query + mapping layer

**Files:**
- Create: `src/lib/supabase/applications.ts`

**Interfaces:**
- Consumes: `getSupabaseClient()` from `src/lib/supabase/client.ts` (existing, returns a cached `SupabaseClient`); `Application`, `DocumentItem`, `TimelineEntry`, `Stage` types from `src/lib/mock-data.ts` (existing, unchanged).
- Produces: `fetchApplications(): Promise<Application[]>` and `fetchApplicationByReference(reference: string): Promise<Application | null>` — both used by Tasks 3, 4, 6, 7.

- [ ] **Step 1: Create the file**

```ts
// src/lib/supabase/applications.ts
//
// Phase 10b-2 — real Supabase reads for applications, replacing the Zustand
// mock store for every view except /admin/access (still 10b-3; it keeps
// reading src/lib/applications.ts until the grant/revoke UI goes real too).
//
// No client-side visibility filtering happens here: RLS (Phase 10b-1)
// already restricts which rows a query can return, so fetchApplications()
// and fetchApplicationByReference() run the exact same query for admins and
// non-admins — the access boundary is enforced by Postgres, not this code.

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Application, DocumentItem, TimelineEntry, Stage } from "@/lib/mock-data";

type ApplicationRow = {
  id: string;
  reference: string;
  title: string;
  service: string;
  sector: string;
  location: string;
  country: string;
  coords: string | null;
  stage: string;
  status_note: string | null;
  lead: string;
  client_name: string;
  hero: string | null;
  submitted_at: string;
};

type DocumentRow = {
  name: string;
  kind: string;
  size_label: string | null;
  status: string;
  uploaded_at: string | null;
};

type ActivityRow = {
  occurred_at: string;
  actor: string;
  kind: string;
  body: string;
};

const APPLICATION_COLUMNS =
  "id, reference, title, service, sector, location, country, coords, stage, status_note, lead, client_name, hero, submitted_at";

function toDocument(row: DocumentRow): DocumentItem {
  return {
    name: row.name,
    kind: row.kind,
    size: row.size_label ?? "—",
    status: row.status as DocumentItem["status"],
    uploaded: row.uploaded_at ? row.uploaded_at.slice(0, 10) : undefined,
  };
}

function toTimelineEntry(row: ActivityRow): TimelineEntry {
  return {
    at: row.occurred_at.slice(0, 10),
    actor: row.actor,
    kind: row.kind as TimelineEntry["kind"],
    text: row.body,
  };
}

function toApplication(
  row: ApplicationRow,
  documents: DocumentRow[],
  activity: ActivityRow[]
): Application {
  return {
    id: row.reference,
    title: row.title,
    service: row.service,
    sector: row.sector as Application["sector"],
    location: row.location,
    country: row.country as Application["country"],
    coords: row.coords ?? "",
    stage: row.stage as Stage,
    statusNote: row.status_note ?? undefined,
    lead: row.lead,
    clientName: row.client_name,
    hero: row.hero ?? "",
    submitted: row.submitted_at,
    documents: documents.map(toDocument),
    timeline: activity.map(toTimelineEntry),
  };
}

/**
 * Every application the signed-in account can see. Admins get every row;
 * everyone else gets only what RLS lets through via a live grant in
 * agv_application_access. Same query either way — Postgres does the
 * filtering (proven in Phase 10b-1).
 */
export async function fetchApplications(): Promise<Application[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("agv_applications")
    .select(APPLICATION_COLUMNS)
    .order("reference", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ApplicationRow[]).map((row) => toApplication(row, [], []));
}

/**
 * One application by its display reference (e.g. "AGV-2026-0142"), with its
 * documents and activity, or null if it doesn't exist OR the signed-in
 * account has no live grant for it. RLS makes those two cases
 * indistinguishable on purpose — a user can't tell "wrong reference" from
 * "not yours" for something they can't see.
 */
export async function fetchApplicationByReference(
  reference: string
): Promise<Application | null> {
  const supabase = getSupabaseClient();

  const { data: appRow, error: appError } = await supabase
    .from("agv_applications")
    .select(APPLICATION_COLUMNS)
    .ilike("reference", reference)
    .maybeSingle();
  if (appError) throw appError;
  if (!appRow) return null;
  const application = appRow as ApplicationRow;

  const [docsResult, activityResult] = await Promise.all([
    supabase
      .from("agv_documents")
      .select("name, kind, size_label, status, uploaded_at")
      .eq("application_id", application.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("agv_activity_entries")
      .select("occurred_at, actor, kind, body")
      .eq("application_id", application.id)
      .order("occurred_at", { ascending: true }),
  ]);
  if (docsResult.error) throw docsResult.error;
  if (activityResult.error) throw activityResult.error;

  return toApplication(
    application,
    (docsResult.data ?? []) as DocumentRow[],
    (activityResult.data ?? []) as ActivityRow[]
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors reported for `src/lib/supabase/applications.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/applications.ts
git commit -m "Add Supabase query layer for applications (Phase 10b-2)"
```

---

## Task 3: Shared loading/error placeholder + `AdminDashboard` rewire

**Files:**
- Create: `src/components/RegisterStatus.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `fetchApplications()` from Task 2; `useSession` from `src/lib/session.ts` (existing, unchanged) for `account?.id` as a refetch trigger.
- Produces: `RegisterStatus` component, also consumed by Task 4.

- [ ] **Step 1: Create `RegisterStatus.tsx`**

```tsx
// src/components/RegisterStatus.tsx
//
// Loading/error placeholder for the applications register, styled to match
// ApplicationRegister's header and ruled-table framing so the swap into the
// real table doesn't jump. New in Phase 10b-2 — Supabase reads aren't
// synchronous the way the old mock store was. The spinner reuses the exact
// markup AppShell already uses for its own hydration gate.

export default function RegisterStatus({
  eyebrow,
  title,
  kind,
  message,
}: {
  eyebrow: string;
  title: string;
  kind: "loading" | "error";
  message?: string;
}) {
  return (
    <div>
      <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
        {title}
      </h1>
      <div className="mt-9 border-y-2 border-bone/80 py-16 text-center">
        {kind === "loading" ? (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-3 text-sm text-ash"
          >
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
            />
            Loading applications…
          </p>
        ) : (
          <>
            <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
              We couldn&apos;t load your applications
            </h2>
            <p className="mt-2 text-sm text-ash">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `AdminDashboard.tsx`**

```tsx
"use client";

// /admin register: every application in a sortable table, straight through to
// its detail page. Phase 10b-2 — reads real Supabase data via
// fetchApplications(); RLS (Phase 10b-1) already returns every row for an
// admin, so this component does no filtering of its own.

import { useEffect, useState } from "react";
import ApplicationRegister from "@/components/ApplicationRegister";
import RegisterStatus from "@/components/RegisterStatus";
import { fetchApplications } from "@/lib/supabase/applications";
import { useSession } from "@/lib/session";
import type { Application } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; applications: Application[] };

export default function AdminDashboard() {
  const accountId = useSession((s) => s.account?.id);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchApplications()
      .then((applications) => {
        if (!cancelled) setState({ status: "ready", applications });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              e instanceof Error ? e.message : "Something went wrong loading applications.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the signed-in identity changes — the dev QuickSwitch
    // can move between two "user" accounts without a route change, since
    // both land on the same /portal path.
  }, [accountId]);

  if (state.status === "loading") {
    return <RegisterStatus eyebrow="Admin console" title="Applications" kind="loading" />;
  }
  if (state.status === "error") {
    return (
      <RegisterStatus
        eyebrow="Admin console"
        title="Applications"
        kind="error"
        message={state.message}
      />
    );
  }

  const applications = state.applications;
  return (
    <ApplicationRegister
      eyebrow="Admin console"
      title="Applications"
      intro={`All ${applications.length} applications on record. Select a reference number to review an application's status, documents, and activity — or to update it.`}
      applications={applications}
      hrefBase="/admin/applications"
    />
  );
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server (`npm run dev`, port 3170) if not already running, sign in as `admin@agv-demo.com`, load `/admin`. Expected: a brief loading placeholder (may be too fast to see on localhost — throttle network in devtools if you want to see it), then the register table exactly as before, showing all 3 applications.

- [ ] **Step 5: Commit**

```bash
git add src/components/RegisterStatus.tsx src/components/admin/AdminDashboard.tsx
git commit -m "Rewire AdminDashboard to read real Supabase applications"
```

---

## Task 4: `UserPortalView` rewire

**Files:**
- Modify: `src/components/UserPortalView.tsx`

**Interfaces:**
- Consumes: `fetchApplications()` (Task 2), `RegisterStatus` (Task 3).

- [ ] **Step 1: Rewrite `UserPortalView.tsx`**

```tsx
"use client";

// The portal home for a normal user: a register of only the applications
// they've been granted access to (admins never reach /portal — the shell
// routes them to /admin). Shares ApplicationRegister with the admin view.
// Phase 10b-2 — reads real Supabase data; RLS (10b-1) already restricts the
// rows to whatever this account holds a live grant for, so there's no
// client-side visibility filtering here anymore.

import { useEffect, useState } from "react";
import ApplicationRegister from "@/components/ApplicationRegister";
import RegisterStatus from "@/components/RegisterStatus";
import { fetchApplications } from "@/lib/supabase/applications";
import { useSession } from "@/lib/session";
import type { Application } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; applications: Application[] };

export default function UserPortalView() {
  const accountId = useSession((s) => s.account?.id);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchApplications()
      .then((applications) => {
        if (!cancelled) setState({ status: "ready", applications });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              e instanceof Error ? e.message : "Something went wrong loading your applications.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (state.status === "loading") {
    return <RegisterStatus eyebrow="Your portal" title="Your applications" kind="loading" />;
  }
  if (state.status === "error") {
    return (
      <RegisterStatus
        eyebrow="Your portal"
        title="Your applications"
        kind="error"
        message={state.message}
      />
    );
  }

  const mine = state.applications;
  return (
    <ApplicationRegister
      eyebrow="Your portal"
      title="Your applications"
      intro={
        mine.length === 1
          ? "You have access to 1 application. Select its reference number to review its status, documents, and activity."
          : `You have access to ${mine.length} applications. Select a reference number to review its status, documents, and activity.`
      }
      applications={mine}
      hrefBase="/portal/applications"
      emptyState={
        <div className="rounded-md border border-dashed border-ash/30 bg-pine/40 px-6 py-16 text-center">
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-ash">
            Nothing to show yet
          </p>
          <p className="mt-2 text-sm text-ash">
            You don&apos;t have access to any applications yet. Ask an
            administrator to grant you access.
          </p>
        </div>
      }
    />
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Sign in as `user1@agv-demo.com`, load `/portal`. Expected: register shows exactly 2 applications (`AGV-2026-0142`, `AGV-2026-0118`), intro text reads "You have access to 2 applications...". Sign in as `user2@agv-demo.com`: exactly 1 application (`AGV-2026-0161`), intro text reads "You have access to 1 application...".

- [ ] **Step 4: Commit**

```bash
git add src/components/UserPortalView.tsx
git commit -m "Rewire UserPortalView to read real Supabase applications"
```

---

## Task 5: `ApplicationDetail` — callback props instead of direct store calls

No visual or DOM change in this task — only where the two mutation functions come from.

**Files:**
- Modify: `src/components/ApplicationDetail.tsx`

**Interfaces:**
- Produces: `onStageChange?: (stage: Stage, actor: string) => void` and `onAddNote?: (text: string, actor: string) => void` props, consumed by Task 6 (`AdminApplicationView`).

- [ ] **Step 1: Remove the `useApplications` import**

Delete this line:

```ts
import { useApplications } from "@/lib/applications";
```

- [ ] **Step 2: Extend `Props`**

Replace:

```ts
type Props = {
  app: Application;
  /** admins get a status select and an add-note form */
  canEdit?: boolean;
};
```

with:

```ts
type Props = {
  app: Application;
  /** admins get a status select and an add-note form */
  canEdit?: boolean;
  /** called with the new stage + the acting user's name; the caller owns persistence */
  onStageChange?: (stage: Stage, actor: string) => void;
  /** called with the note text + the acting user's name; the caller owns persistence */
  onAddNote?: (text: string, actor: string) => void;
};
```

- [ ] **Step 3: Update the function signature and body**

Replace:

```ts
export default function ApplicationDetail({ app, canEdit = false }: Props) {
```

with:

```ts
export default function ApplicationDetail({
  app,
  canEdit = false,
  onStageChange: onStageChangeProp,
  onAddNote: onAddNoteProp,
}: Props) {
```

Replace:

```ts
  const setStage = useApplications((s) => s.setStage);
  const addNote = useApplications((s) => s.addNote);
  const account = useSession((s) => s.account);
  const actor = account?.name ?? "A. Mercer";
  const [note, setNote] = useState("");

  function onStageChange(e: ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value as Stage;
    setStage(app.id, stage, actor);
    const label = PIPELINE.find((p) => p.id === stage)?.label ?? stage;
    showToast(`Status changed to ${label}.`);
  }

  function onNoteSubmit(e: FormEvent) {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    addNote(app.id, text, actor);
    setNote("");
    showToast("Note saved.");
  }
```

with:

```ts
  const account = useSession((s) => s.account);
  const actor = account?.name ?? "A. Mercer";
  const [note, setNote] = useState("");

  function onStageChange(e: ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value as Stage;
    onStageChangeProp?.(stage, actor);
    const label = PIPELINE.find((p) => p.id === stage)?.label ?? stage;
    showToast(`Status changed to ${label}.`);
  }

  function onNoteSubmit(e: FormEvent) {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    onAddNoteProp?.(text, actor);
    setNote("");
    showToast("Note saved.");
  }
```

Nothing else in the file changes — the JSX, `Meta`, `FileBadge`, toast, and stepper markup are all untouched.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors, no unused-import warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/ApplicationDetail.tsx
git commit -m "ApplicationDetail: take edit callbacks as props instead of the mock store"
```

---

## Task 6: `AdminApplicationView` rewire

**Files:**
- Modify: `src/components/admin/AdminApplicationView.tsx`

**Interfaces:**
- Consumes: `fetchApplicationByReference()` (Task 2), `ApplicationDetail`'s new `onStageChange`/`onAddNote` props (Task 5), `PIPELINE` and `Stage` from `src/lib/mock-data.ts` (existing).

- [ ] **Step 1: Rewrite `AdminApplicationView.tsx`**

```tsx
"use client";

// Admin detail view: the same ApplicationDetail the user portal uses, with
// edit controls enabled. Phase 10b-2 fetches the real record from Supabase
// (fetchApplicationByReference) instead of the mock store.
//
// Status changes and notes stay LOCAL to this component's state for this
// slice — 10b-2 is read-only against Supabase by design (writes land in
// 10b-3). Routing them through onStageChange/onAddNote instead of hiding the
// controls keeps Phase 16's interaction intact; a refresh discards the edit,
// which is the honest behavior until 10b-3 makes it a real write.

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationDetail from "@/components/ApplicationDetail";
import { fetchApplicationByReference } from "@/lib/supabase/applications";
import { useSession } from "@/lib/session";
import { PIPELINE, type Application, type Stage } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found" }
  | { status: "ready"; app: Application };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminApplicationView({ id }: { id: string }) {
  const accountId = useSession((s) => s.account?.id);

  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — fall through to the unknown state
  }

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchApplicationByReference(clean)
      .then((app) => {
        if (cancelled) return;
        setState(app ? { status: "ready", app } : { status: "not-found" });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Something went wrong loading this application.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [clean, accountId]);

  function handleStageChange(stage: Stage, actor: string) {
    setState((s) => {
      if (s.status !== "ready") return s;
      const label = PIPELINE.find((p) => p.id === stage)?.label ?? stage;
      return {
        status: "ready",
        app: {
          ...s.app,
          stage,
          statusNote: undefined,
          timeline: [
            ...s.app.timeline,
            { at: todayIso(), actor, kind: "status" as const, text: `Status moved to ${label}.` },
          ],
        },
      };
    });
  }

  function handleAddNote(text: string, actor: string) {
    setState((s) => {
      if (s.status !== "ready") return s;
      return {
        status: "ready",
        app: {
          ...s.app,
          timeline: [
            ...s.app.timeline,
            { at: todayIso(), actor, kind: "comment" as const, text },
          ],
        },
      };
    });
  }

  return (
    <>
      <Link
        href="/admin"
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash transition hover:text-signal"
      >
        ← Back to all applications
      </Link>

      {state.status === "ready" ? (
        <div className="mt-8">
          <ApplicationDetail
            app={state.app}
            canEdit
            onStageChange={handleStageChange}
            onAddNote={handleAddNote}
          />
        </div>
      ) : state.status === "loading" ? (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <p
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-3 text-sm text-ash"
          >
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
            />
            Loading…
          </p>
        </div>
      ) : state.status === "error" ? (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            We couldn&apos;t load this application
          </h1>
          <p className="mt-2 text-sm text-ash">{state.message}</p>
        </div>
      ) : (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            We couldn&apos;t find this application
          </h1>
          <p className="mt-2 text-sm text-ash">
            Nothing matches that reference number. Check the link, or go back to
            all applications.
          </p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Sign in as admin, open `/admin/applications/AGV-2026-0142`. Expected: identical ruled document to before — letterhead, stepper, documents in the order EIS Addendum → Noise & Vibration → Groundwater → Site Access (this confirms Task 1's seed fix took effect — re-run the seed first if this order looks wrong), activity timeline. Change the status dropdown: toast appears, stepper advances, a new "Status moved to …" activity entry appears. Add a note: toast appears, note appears in the activity list. Reload the page: both edits are gone (expected — session-local only, not yet in scope to persist). Navigate to `/admin/applications/does-not-exist`: "We couldn't find this application" renders.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminApplicationView.tsx
git commit -m "Rewire AdminApplicationView to read real Supabase applications"
```

---

## Task 7: `UserApplicationView` rewire

**Files:**
- Modify: `src/components/UserApplicationView.tsx`

**Interfaces:**
- Consumes: `fetchApplicationByReference()` (Task 2).

- [ ] **Step 1: Rewrite `UserApplicationView.tsx`**

```tsx
"use client";

// User-facing application detail: renders the shared ApplicationDetail
// read-only. Phase 10b-2 fetches the real record from Supabase — RLS (10b-1)
// already returns null for an application this account has no live grant
// for, so there's no separate client-side visibility check anymore;
// "doesn't exist" and "not granted" collapse into the same state on purpose.

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationDetail from "@/components/ApplicationDetail";
import { fetchApplicationByReference } from "@/lib/supabase/applications";
import { useSession } from "@/lib/session";
import type { Application } from "@/lib/mock-data";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "blocked" }
  | { status: "ready"; app: Application };

export default function UserApplicationView({ id }: { id: string }) {
  const accountId = useSession((s) => s.account?.id);

  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — falls through to the unavailable state
  }

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchApplicationByReference(clean)
      .then((app) => {
        if (cancelled) return;
        setState(app ? { status: "ready", app } : { status: "blocked" });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Something went wrong loading this application.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [clean, accountId]);

  return (
    <>
      <Link
        href="/portal"
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash transition hover:text-signal"
      >
        ← Back to your applications
      </Link>

      {state.status === "ready" ? (
        <div className="mt-8">
          <ApplicationDetail app={state.app} />
        </div>
      ) : state.status === "loading" ? (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <p
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-3 text-sm text-ash"
          >
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
            />
            Loading…
          </p>
        </div>
      ) : state.status === "error" ? (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            We couldn&apos;t load this application
          </h1>
          <p className="mt-2 text-sm text-ash">{state.message}</p>
        </div>
      ) : (
        <div className="mt-10 max-w-3xl border-y-2 border-bone/80 py-16 text-center">
          <h1 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            You don&apos;t have access to this application
          </h1>
          <p className="mt-2 text-sm text-ash">
            It isn&apos;t one of your applications. Ask an administrator if you
            need access to it.
          </p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Sign in as `user1@agv-demo.com`. Open `/portal/applications/AGV-2026-0142` (granted): renders normally. Open `/portal/applications/AGV-2026-0161` (ungranted, exists for user2): "You don't have access to this application" renders — not a crash, not a blank page. Open `/portal/applications/AGV-2026-9999` (doesn't exist at all): same message (expected — RLS makes the two cases indistinguishable by design).

- [ ] **Step 4: Commit**

```bash
git add src/components/UserApplicationView.tsx
git commit -m "Rewire UserApplicationView to read real Supabase applications"
```

---

## Task 8: Drop stale build-time params sourced from mock data

**Files:**
- Modify: `src/app/admin/applications/[id]/page.tsx`
- Modify: `src/app/portal/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere — these are route entry points.

- [ ] **Step 1: Rewrite `src/app/admin/applications/[id]/page.tsx`**

```tsx
// Admin application detail — renders the shared ApplicationDetail with
// edit controls (status select, add note) via AdminApplicationView.
// Phase 10b-2: no more generateStaticParams off mock data — the register now
// reads real Supabase rows, so build-time params would drift from reality.
// Vercel builds don't have DB connectivity by design (see the
// migrate-deploy removal), so params are resolved per-request instead.

import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AdminApplicationView from "@/components/admin/AdminApplicationView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — fall back to the raw id
  }
  return { title: clean };
}

export default async function AdminApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell expect="admin">
      <AdminApplicationView id={id} />
    </AppShell>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/portal/applications/[id]/page.tsx`**

```tsx
// User application detail — the shared read-only view, gated by RLS inside
// UserApplicationView. Phase 10b-2: same generateStaticParams removal as the
// admin route — see that file's comment.

import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import UserApplicationView from "@/components/UserApplicationView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — fall back to the raw id
  }
  return { title: clean };
}

export default async function PortalApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell expect="user">
      <UserApplicationView id={id} />
    </AppShell>
  );
}
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (this also full-typechecks the project — the fastest way to catch any type mismatch across all the files this plan touched). No DB connectivity is required for this build (per the earlier `migrate-deploy` removal), so it's safe to run without live credentials.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/applications/\[id\]/page.tsx src/app/portal/applications/\[id\]/page.tsx
git commit -m "Drop mock-data-sourced generateStaticParams from application detail routes"
```

---

## Task 9: End-to-end browser verification

This is the task the spec calls out explicitly: prove the *running UI* — not just direct API calls (that was 10b-1) — respects RLS, and that Phase 10a/10c surfaces are unaffected.

**Files:** none (verification only).

- [ ] **Step 1: Confirm the reseed from Task 1 landed**

Ask the user to confirm `node supabase/seed-domain.mjs` has been re-run since Task 1's edit, if not already done in Task 1 Step 3.

- [ ] **Step 2: Admin — full visibility**

Sign in as `admin@agv-demo.com` in the running dev server (Claude Browser tool). `/admin` shows all 3 applications. Open each of the 3 detail pages; confirm every field (title, service, sector, location, stage/status chip, lead, client, submitted date, coordinates, document list — **including `AGV-2026-0142`'s document order**, activity timeline) matches `src/lib/mock-data.ts` exactly.

- [ ] **Step 3: user1 — partial visibility, UI-level**

Sign in as `user1@agv-demo.com`. `/portal` shows exactly 2 applications (`AGV-2026-0142`, `AGV-2026-0118`). Navigate directly to `/portal/applications/AGV-2026-0161` (granted to user2, not user1): confirm the "You don't have access to this application" state renders — no crash, no blank screen, no console error.

- [ ] **Step 4: user2 — partial visibility, UI-level**

Sign in as `user2@agv-demo.com`. `/portal` shows exactly 1 application (`AGV-2026-0161`). Navigate to `/portal/applications/AGV-2026-0142`: same blocked-state check as Step 3.

- [ ] **Step 5: QuickSwitch same-route refetch**

While on `/portal` as one user account, use the dev QuickSwitch to move to the other user account. Confirm the register updates to the new account's applications without a manual refresh (this is the fix for the same-route staleness risk identified during planning — both `user1` and `user2` land on `/portal`, so without refetching on identity change the stale list would persist).

- [ ] **Step 6: Phase 10a/10c regression check**

With any account signed in: open `/account`, confirm password-change and MFA sections render as before. Confirm the sidebar navigation, mobile drawer toggle, and display-settings popover are unaffected. Confirm `/admin/access` (AccessMatrix, still mock-backed) still renders and its checkboxes still work — this page is untouched by this plan and should show no behavior change.

- [ ] **Step 7: Record results**

Take note of exactly which account/application combination was checked and what was observed at each step above — this goes into `STATUS.md` in Task 10, per the requirement to be specific about how RLS-respecting behavior was verified in the running UI (not just that it was checked).

---

## Task 10: Update STATUS.md

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Overwrite `STATUS.md`** using the project's standard template (see `CLAUDE.md`/handoff doc), reporting:
  - State: complete (or blocked, with specifics, if Task 9 surfaced an issue).
  - Done this session: the rewire across all 4 components + the seed ordering fix + the two page.tsx simplifications.
  - Files added/changed: the full list from "File Structure" above.
  - Decisions made: RLS-driven filtering replaces client-side visibility logic; edit controls stay local-only pending 10b-3; `/admin/access` and `AppShell`'s reset button deliberately left on the mock store; `generateStaticParams` removed from both detail routes.
  - Known issues / TODO: admin edits don't persist (by design, 10b-3 fixes this); document order depends on the reseeded `created_at` staggering from Task 1.
  - Verification detail: the specific account/application/expected-vs-observed results from Task 9, Steps 2–6 — not just "verified."
  - Next step: 10b-3 (writes: status change + add-note against Supabase; `/admin/access` grant/revoke UI against `agv_application_access`; real Storage upload/download).

- [ ] **Step 2: Commit**

```bash
git add STATUS.md
git commit -m "Close out Phase 10b-2: real Supabase reads verified end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** rewire 4 components → Tasks 3,4,6,7. Loading/error states → Tasks 3,4,6,7 + `RegisterStatus` (Task 3). UI-level RLS proof → Task 9. Existing blocked/not-found states still trigger → preserved verbatim in Tasks 6,7 and re-checked in Task 9. Out-of-scope items (writes, `/admin/access`, Storage) explicitly not touched — called out in Global Constraints and Task 6's header comment.
- **Placeholder scan:** every task has complete code, no TODOs, no "similar to Task N" shortcuts — `AdminApplicationView` and `UserApplicationView` are fully written out separately despite their similarity, since an implementer working from just one task shouldn't need to cross-reference another.
- **Type consistency:** `Application`/`DocumentItem`/`TimelineEntry`/`Stage` types are the existing ones from `mock-data.ts`, unchanged, used identically across Tasks 2, 3, 4, 5, 6, 7. `onStageChange`/`onAddNote` signatures introduced in Task 5 match their call sites in Task 6 exactly (`(stage: Stage, actor: string) => void` / `(text: string, actor: string) => void`).
