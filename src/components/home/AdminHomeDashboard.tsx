"use client";

// Admin's Dashboard (/dashboard) — a complete copy of the reference
// Dashboard's own layout (docs/superpowers/plans/2026-08-07-artea-green-
// glow-reskin.md), per direct screenshot comparison: a 4-tile stats row,
// a 2-col grid ("Applications in flight" + "Recent activity"), and 3 nav
// cards (Applications/People/Companies) — real data throughout, not the
// reference's fake portal-data.ts numbers.
//
// One deliberate scope change from the Dashboard task's original brief:
// the earlier version had "Unassigned clients" and "Companies without a
// manager" as their own centerpiece panels. The reference has no
// equivalent concept at all, so matching its layout completely meant
// dropping both as separate panels. The unassigned-clients signal isn't
// lost — it's folded into the "Client companies" tile's note line
// ("N unassigned client(s) pending"), the same slot the reference's own
// mockup uses for exactly this kind of secondary context ("1 unassigned
// client pending" in the original screenshot). The companies-without-a-
// manager flag has no equivalent slot here and is genuinely dropped from
// this page — still visible per-company on /admin/companies, just not
// surfaced on the dashboard anymore. Flagged here, not silently done.
//
// "Recent activity" reads agv_audit_log (admin-only RLS — "audit — admin
// read", 20260722120000) — real system activity, not the reference's
// invented copy. describeActivity() below covers agv_applications/
// agv_documents/agv_application_access (the original four audited tables)
// plus agv_companies/agv_company_applications/agv_profiles, added
// 20260808110000 to close the Companies feature's own audit gap — that
// last one also means role changes (previously unaudited) show up here
// now too, as a direct side effect of covering agv_profiles generally, not
// a separate mechanism. fetchAuditLog() (auditLog.ts) has no table_name
// filter, so any table a trigger writes to shows up here automatically —
// describeActivity()'s `default` case renders anything not given its own
// readable copy yet as a generic "did X to a record" line rather than
// silently dropping it.

import Link from "next/link";
import { fetchApplications } from "@/lib/supabase/applications";
import { fetchClientProfiles, fetchCompanies, type ClientProfile, type Company } from "@/lib/supabase/companies";
import { fetchAllProfiles, type ProfileForRoleAssignment } from "@/lib/supabase/roles";
import { fetchAuditLog, type AuditLogEntry } from "@/lib/supabase/auditLog";
import { PIPELINE, type Application } from "@/lib/mock-data";
import { formatDate } from "@/lib/format";
import { useAsyncResource } from "@/lib/useAsyncResource";
import SurfaceState from "@/components/SurfaceState";
import StatusChip from "@/components/StatusChip";
import HomeShell, { HomePanel, HomePillLink, StatTile } from "@/components/home/HomeShell";

const ACTIVITY_LIMIT = 5;

type AdminDashboardData = {
  applications: Application[];
  clients: ClientProfile[];
  companies: Company[];
  profiles: ProfileForRoleAssignment[];
  activity: AuditLogEntry[];
};

function loadAdminDashboard(): Promise<AdminDashboardData> {
  return Promise.all([
    fetchApplications(),
    fetchClientProfiles(),
    fetchCompanies(),
    fetchAllProfiles(),
    fetchAuditLog(ACTIVITY_LIMIT),
  ]).then(([applications, clients, companies, profiles, activity]) => ({
    applications,
    clients,
    companies,
    profiles,
    activity,
  }));
}

function stageLabel(stage: unknown): string {
  return PIPELINE.find((s) => s.id === stage)?.label ?? String(stage ?? "");
}

/** Turns one agv_audit_log row into a headline + optional detail line,
 * matching the reference's "actor did X" / detail / timestamp shape —
 * covering only what the table genuinely has (see file header comment). */
function describeActivity(
  entry: AuditLogEntry,
  actorName: string
): { headline: string; detail: string } {
  const changes = entry.changes as { old?: Record<string, unknown>; new?: Record<string, unknown> } | null;
  const row = changes?.new ?? changes?.old ?? {};
  const reference = typeof row.reference === "string" ? row.reference : null;

  switch (entry.table_name) {
    case "agv_applications": {
      const oldStage = changes?.old?.stage;
      const newStage = changes?.new?.stage;
      if (entry.action === "UPDATE" && oldStage && newStage && oldStage !== newStage) {
        return {
          headline: `${actorName} updated an application status`,
          detail: `${reference ?? "Application"} → ${stageLabel(newStage)}`,
        };
      }
      return {
        headline: `${actorName} ${entry.action === "INSERT" ? "submitted" : "updated"} an application`,
        detail: reference ?? "",
      };
    }
    case "agv_documents": {
      const name = typeof row.name === "string" ? row.name : "a document";
      return {
        headline: `${actorName} ${entry.action === "INSERT" ? "uploaded" : "updated"} a document`,
        detail: name,
      };
    }
    case "agv_application_access": {
      const revoked = changes?.new?.revoked_at;
      return {
        headline: `${actorName} ${entry.action === "INSERT" ? "granted" : revoked ? "revoked" : "updated"} application access`,
        detail: "",
      };
    }
    case "agv_companies": {
      const name = typeof row.name === "string" ? row.name : "a company";
      const verb =
        entry.action === "INSERT" ? "created" : entry.action === "DELETE" ? "deleted" : "renamed";
      return { headline: `${actorName} ${verb} a company`, detail: name };
    }
    case "agv_company_applications": {
      const revoked = changes?.new?.revoked_at;
      return {
        headline: `${actorName} ${entry.action === "INSERT" ? "granted" : revoked ? "revoked" : "updated"} a company's application scope`,
        detail: "",
      };
    }
    case "agv_profiles": {
      const name = typeof row.name === "string" ? row.name : "a profile";
      const oldRole = changes?.old?.role;
      const newRole = changes?.new?.role;
      if (entry.action === "UPDATE" && oldRole && newRole && oldRole !== newRole) {
        return { headline: `${actorName} changed ${name}'s role`, detail: `${oldRole} → ${newRole}` };
      }
      const oldManager = changes?.old?.is_company_manager;
      const newManager = changes?.new?.is_company_manager;
      if (entry.action === "UPDATE" && oldManager !== undefined && oldManager !== newManager) {
        return {
          headline: `${actorName} ${newManager ? "made" : "removed"} ${name} ${newManager ? "a company manager" : "as a company manager"}`,
          detail: "",
        };
      }
      const oldCompany = changes?.old?.company_id;
      const newCompany = changes?.new?.company_id;
      if (entry.action === "UPDATE" && oldCompany !== newCompany) {
        return {
          headline: `${actorName} ${newCompany ? "added" : "removed"} ${name} ${newCompany ? "to" : "from"} a company roster`,
          detail: "",
        };
      }
      if (entry.action === "INSERT") {
        return { headline: `${actorName} created a profile`, detail: name };
      }
      return { headline: `${actorName} updated a profile`, detail: name };
    }
    default:
      return { headline: `${actorName} ${entry.action.toLowerCase()}d a record`, detail: entry.table_name };
  }
}

function formatTimestamp(iso: string): string {
  const time = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso.slice(0, 10))} · ${time}`;
}

export default function AdminHomeDashboard() {
  const { state } = useAsyncResource(loadAdminDashboard, [], "Something went wrong loading the dashboard.");

  return (
    <HomeShell
      eyebrow="Admin console"
      title="Dashboard"
      intro="A single view of what is moving through the compliance pipeline this week — and who is doing the moving."
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
  const { applications, clients, companies, profiles, activity } = data;
  const unassigned = clients.filter((c) => c.company_id === null);
  const inReview = applications.filter((a) => a.stage === "under-review");

  const actorName = (actor: string | null): string =>
    actor ? (profiles.find((p) => p.id === actor)?.name ?? actor) : "System";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Applications on record"
          value={applications.length}
          note={`Across ${companies.length} client program${companies.length === 1 ? "" : "s"}`}
        />
        <StatTile label="In review" value={inReview.length} note="Assigned to staff" />
        <StatTile label="Portal members" value={profiles.length} note="Admin, staff and clients" />
        <StatTile
          label="Client companies"
          value={companies.length}
          note={
            unassigned.length === 0
              ? "Every client is assigned"
              : `${unassigned.length} unassigned client${unassigned.length === 1 ? "" : "s"} pending`
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <HomePanel
          title="Applications in flight"
          action={<HomePillLink href="/admin">View all →</HomePillLink>}
        >
          {applications.length === 0 ? (
            <p className="text-sm text-ash">No applications on record yet.</p>
          ) : (
            <ul className="divide-y divide-ash/15">
              {applications.map((app) => (
                <li key={app.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-mono text-xs text-ash">{app.id}</p>
                    <p className="mt-1 text-sm font-medium text-bone">{app.title}</p>
                    <p className="text-xs font-light text-ash">
                      {app.service} · {app.location} · Lead {app.lead}
                    </p>
                  </div>
                  <StatusChip stage={app.stage} />
                </li>
              ))}
            </ul>
          )}
        </HomePanel>

        <HomePanel title="Recent activity">
          {activity.length === 0 ? (
            <p className="text-sm text-ash">No activity yet.</p>
          ) : (
            <ul className="space-y-5">
              {activity.map((entry) => {
                const { headline, detail } = describeActivity(entry, actorName(entry.actor));
                return (
                  <li key={entry.id} className="border-l border-signal/25 pl-4">
                    <p className="text-sm text-bone">{headline}</p>
                    {detail && <p className="mt-1 text-xs font-light text-ash">{detail}</p>}
                    <p className="mt-1 text-[11px] font-light text-ash/70">{formatTimestamp(entry.at)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </HomePanel>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { href: "/admin", title: "Applications", body: "Review status, documents and audit trails." },
          { href: "/admin/people", title: "People", body: "Set roles, grant application access, read activity." },
          { href: "/admin/companies", title: "Companies", body: "Create companies and assign client managers." },
        ].map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-sm border border-ash/20 bg-pine p-6 transition-colors hover:border-signal"
          >
            <p className="text-lg font-semibold text-bone group-hover:text-signal">{card.title}</p>
            <p className="mt-2 text-sm font-light text-ash">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
