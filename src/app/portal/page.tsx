import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import StatusChip from "@/components/StatusChip";
import { applicationsForClient } from "@/lib/mock-data";
import { DEMO_ACCOUNTS } from "@/lib/session";

export const metadata: Metadata = { title: "Client portal" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

// Placeholder dashboard — the full single-application view (stage stepper,
// documents, activity feed) is Phase 3.
export default function PortalPage() {
  const app = applicationsForClient(DEMO_ACCOUNTS.client.email)[0];

  return (
    <AppShell expect="client">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-contour">
        Client portal
      </p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.02em] text-bone sm:text-5xl">
        Your application
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
        Live status for your engagement with Artea Green Ventures. The full
        tracking view — stage timeline, documents and activity — arrives in
        Phase 3.
      </p>

      <div className="mt-10 max-w-2xl rounded-xl border border-ash/15 bg-pine p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[11px] tracking-[0.14em] text-ash">
            {app.id}
          </span>
          <StatusChip stage={app.stage} note={app.statusNote} />
        </div>

        <h2 className="mt-5 font-display text-2xl font-extrabold tracking-[-0.01em] text-bone">
          {app.title}
        </h2>
        <p className="mt-1 text-sm text-ash">{app.service}</p>

        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ash/10 pt-6 sm:grid-cols-4">
          <Meta k="Sector" v={app.sector} />
          <Meta k="Location" v={app.location} />
          <Meta k="AGV lead" v={app.lead} />
          <Meta k="Submitted" v={formatDate(app.submitted)} />
        </dl>
      </div>
    </AppShell>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">
        {k}
      </dt>
      <dd className="mt-1.5 text-sm text-bone">{v}</dd>
    </div>
  );
}
