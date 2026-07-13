// Stub detail route — the full detail view (stepper, documents, activity)
// is Phase 4. This exists so table rows don't dead-end.

import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusChip from "@/components/StatusChip";
import TopoField from "@/components/TopoField";
import { formatDate } from "@/lib/format";
import { APPLICATIONS, type Application } from "@/lib/mock-data";

export function generateStaticParams() {
  return APPLICATIONS.map((a) => ({ id: a.id }));
}

function findApp(rawId: string): Application | undefined {
  let clean: string;
  try {
    clean = decodeURIComponent(rawId).toLowerCase();
  } catch {
    return undefined;
  }
  return APPLICATIONS.find((a) => a.id.toLowerCase() === clean);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const app = findApp(id);
  return { title: app ? app.id : "Application not found" };
}

export default async function ApplicationStubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = findApp(id);

  return (
    <AppShell expect="admin">
      <Link
        href="/admin"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash transition hover:text-signal"
      >
        ← All applications
      </Link>

      {!app ? (
        <div className="relative mt-10 overflow-hidden rounded-xl border border-dashed border-ash/25 py-20 text-center">
          <TopoField
            className="opacity-30"
            seed={53}
            peaks={[{ cx: 720, cy: 450, r0: 55, rings: 5, gap: 44 }]}
          />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
              Unknown application
            </p>
            <p className="mt-2 text-sm text-ash/80">
              No case in the demo data matches this ID.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.14em] text-ash">{app.id}</span>
            <StatusChip stage={app.stage} note={app.statusNote} />
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-black tracking-[-0.02em] text-bone sm:text-4xl">
            {app.title}
          </h1>
          <p className="mt-2 text-sm text-ash">{app.service}</p>

          <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-t border-ash/10 pt-6 sm:grid-cols-5">
            <Meta k="Client" v={app.clientName} />
            <Meta k="Sector" v={app.sector} />
            <Meta k="Location" v={app.location} />
            <Meta k="AGV lead" v={app.lead} />
            <Meta k="Submitted" v={formatDate(app.submitted)} />
          </dl>

          <div className="relative mt-10 overflow-hidden rounded-xl border border-dashed border-ash/25">
            <TopoField
              className="opacity-40"
              seed={31}
              peaks={[{ cx: 720, cy: 460, r0: 65, rings: 6, gap: 46 }]}
            />
            <div className="relative flex min-h-52 items-center justify-center p-10">
              <p className="text-center font-mono text-[11px] uppercase leading-loose tracking-[0.2em] text-ash">
                Stage stepper · documents · activity feed
                <br />
                <span className="text-amber">full detail view arrives in Phase 4</span>
              </p>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">{k}</dt>
      <dd className="mt-1.5 text-sm text-bone">{v}</dd>
    </div>
  );
}
