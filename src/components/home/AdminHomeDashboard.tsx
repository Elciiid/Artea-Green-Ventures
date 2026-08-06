"use client";

// Admin's /home dashboard — an operational read, not a second Companies
// admin page. Three sections: the unassigned-clients queue (the centerpiece
// per the Dashboard brief — a real backlog, not a decorative widget), a
// simple company/application overview, and a flag for companies whose
// roster has clients but no manager (only AGV can manage those day-to-day).
//
// All three read from fetchClientProfiles()/fetchCompanies()/
// fetchApplications() — the same calls the existing Companies/Applications
// admin pages already use — and only group/filter client-side, matching
// this codebase's established "fetch once, compute in the UI" convention
// (see companies.ts's own header comment). No new backend, per the brief.

import Link from "next/link";
import { fetchApplications } from "@/lib/supabase/applications";
import { fetchClientProfiles, fetchCompanies, type ClientProfile, type Company } from "@/lib/supabase/companies";
import type { Application } from "@/lib/mock-data";
import { companiesWithoutManager } from "@/lib/dashboard";
import { useAsyncResource } from "@/lib/useAsyncResource";
import SurfaceState from "@/components/SurfaceState";
import HomeShell, { HomePanel, HomePillLink } from "@/components/home/HomeShell";

type AdminDashboardData = {
  applications: Application[];
  clients: ClientProfile[];
  companies: Company[];
};

function loadAdminDashboard(): Promise<AdminDashboardData> {
  return Promise.all([fetchApplications(), fetchClientProfiles(), fetchCompanies()]).then(
    ([applications, clients, companies]) => ({ applications, clients, companies })
  );
}

export default function AdminHomeDashboard() {
  const { state } = useAsyncResource(loadAdminDashboard, [], "Something went wrong loading the dashboard.");

  return (
    <HomeShell
      eyebrow="Admin console"
      title="Dashboard"
      intro="An operational read before you dive into Applications, People, or Companies."
    >
      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading the dashboard…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load the dashboard"
        errorHeadingLevel="h2"
        empty={false}
        emptyContent={null}
        className="glass rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        {state.status === "ready" && <AdminDashboardBody data={state.data} />}
      </SurfaceState>
    </HomeShell>
  );
}

function AdminDashboardBody({ data }: { data: AdminDashboardData }) {
  const { applications, clients, companies } = data;
  const unassigned = clients.filter((c) => c.company_id === null);
  const flagged = companiesWithoutManager(companies, clients);

  return (
    <div className="flex flex-col gap-6">
      {/* Centerpiece — real visual weight, a direct action, not a decorative
          count. Links straight into /admin/companies, the only page that
          actually assigns a client, rather than reinventing that flow here. */}
      <HomePanel
        title="Unassigned clients"
        action={<HomePillLink href="/admin/companies">Assign clients →</HomePillLink>}
      >
        {unassigned.length === 0 ? (
          <p className="text-sm text-ash">Every client is assigned to a company.</p>
        ) : (
          <div>
            <p className="font-display text-3xl font-bold text-amber">{unassigned.length}</p>
            <p className="mt-1 text-sm text-ash">
              {unassigned.length === 1
                ? "client has no company yet."
                : "clients have no company yet."}
            </p>
            <ul className="mt-4 flex flex-col gap-1.5">
              {unassigned.slice(0, 6).map((client) => (
                <li key={client.id} className="text-sm text-bone">
                  {client.name}
                </li>
              ))}
              {unassigned.length > 6 && (
                <li className="text-xs text-ash">+ {unassigned.length - 6} more</li>
              )}
            </ul>
          </div>
        )}
      </HomePanel>

      <div className="grid gap-6 sm:grid-cols-2">
        <HomePanel title="Overview">
          <dl className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ash">Companies</dt>
              <dd className="font-display text-2xl font-bold text-bone">{companies.length}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ash">Applications on record</dt>
              <dd className="font-display text-2xl font-bold text-bone">{applications.length}</dd>
            </div>
          </dl>
        </HomePanel>

        <HomePanel title="Companies without a manager">
          {flagged.length === 0 ? (
            <p className="text-sm text-ash">
              Every company with clients has at least one manager.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {flagged.map((company) => (
                <li key={company.id}>
                  <Link
                    href={`/admin/companies/${company.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-bone underline decoration-ash/40 decoration-1 underline-offset-4 transition hover:decoration-signal"
                  >
                    {company.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </HomePanel>
      </div>
    </div>
  );
}
