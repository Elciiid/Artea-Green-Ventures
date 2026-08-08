"use client";

// Application access — two real tables, matching the reference's Access
// tab layout (docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md)
// but split per a direct backend-tweak request: Staff still get a personal
// grant/revoke matrix (member rows x application columns), same as before.
// Clients no longer do — since clients "live" inside a company now, the
// second table grants applications to a COMPANY instead of an individual
// client, via the exact same agv_company_applications scope mechanism
// CompanyDetail.tsx's own "Application scope" section already uses.
//
// Checking a company+application box automatically extends live personal
// access to that company's current manager(s) — enforced as a real DB
// invariant (two triggers, supabase/migrations/
// 20260808100000_auto_grant_company_scope_to_managers.sql), not something
// this component has to remember to also do itself. Unchecking only
// narrows the company's scope going forward; it does not retroactively
// revoke a manager's already-issued personal grant — same "ceiling, not
// retroactive" rule CompanyDetail.tsx's scope section already documents.
//
// One thing neither table copies from the reference: admin rows. The
// reference's mockup shows every role including admin with checkboxes
// (all checked, decorative — its Person.access is fake local state with no
// real access-control distinction behind it). This app's real data model
// already excludes admin from fetchGrantableProfiles() entirely, because
// admin access is unconditional, not grant-based — "Administrators can
// always see every application" (kept below) is the accurate statement;
// giving admin fake checkboxes here would misrepresent how access
// actually works.

import { useState } from "react";
import { toast } from "sonner";
import {
  fetchApplicationsForAccess,
  fetchGrantableProfiles,
  fetchLiveGrants,
  grantAccess,
  revokeAccess,
  type AccessApplication,
  type GrantableProfile,
  type LiveGrant,
} from "@/lib/supabase/access";
import {
  fetchAllCompanyApplicationGrants,
  fetchClientProfiles,
  fetchCompanies,
  grantCompanyApplication,
  revokeCompanyApplication,
  type ClientProfile,
  type Company,
  type CompanyApplicationGrantRow,
} from "@/lib/supabase/companies";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 10;

type AccessData = {
  applications: AccessApplication[];
  staff: GrantableProfile[];
  grants: LiveGrant[];
  companies: Company[];
  clients: ClientProfile[];
  companyGrants: CompanyApplicationGrantRow[];
};

function loadAccess(): Promise<AccessData> {
  return Promise.all([
    fetchApplicationsForAccess(),
    fetchGrantableProfiles(),
    fetchLiveGrants(),
    fetchCompanies(),
    fetchClientProfiles(),
    fetchAllCompanyApplicationGrants(),
  ]).then(([applications, profiles, grants, companies, clients, companyGrants]) => ({
    applications,
    staff: profiles.filter((p) => p.role === "staff"),
    grants,
    companies,
    clients,
    companyGrants,
  }));
}

function grantKey(applicationId: string, id: string): string {
  return `${applicationId}:${id}`;
}

export default function AccessMatrix() {
  const { state } = useAsyncResource(loadAccess, [], "Something went wrong loading access.");

  // Staff — personal grants, unchanged from before this pass.
  const [toggledGrants, setToggledGrants] = useState<LiveGrant[] | null>(null);
  const [staffPending, setStaffPending] = useState<Set<string>>(new Set());
  const [staffFilter, setStaffFilter] = useState("");
  const [staffPage, setStaffPage] = useState(1);

  // Companies — scope grants, cascading to the manager via the DB triggers
  // in 20260808100000_auto_grant_company_scope_to_managers.sql.
  const [toggledCompanyGrants, setToggledCompanyGrants] = useState<CompanyApplicationGrantRow[] | null>(
    null
  );
  const [companyPending, setCompanyPending] = useState<Set<string>>(new Set());
  const [companyFilter, setCompanyFilter] = useState("");
  const [companyPage, setCompanyPage] = useState(1);

  const applications = state.status === "ready" ? state.data.applications : [];
  const allStaff = state.status === "ready" ? state.data.staff : [];
  const grants = toggledGrants ?? (state.status === "ready" ? state.data.grants : []);
  const allCompanies = state.status === "ready" ? state.data.companies : [];
  const clients = state.status === "ready" ? state.data.clients : [];
  const companyGrants =
    toggledCompanyGrants ?? (state.status === "ready" ? state.data.companyGrants : []);

  const managersByCompany = new Map<string, ClientProfile[]>();
  for (const c of clients) {
    if (!c.company_id || !c.is_company_manager) continue;
    const list = managersByCompany.get(c.company_id) ?? [];
    list.push(c);
    managersByCompany.set(c.company_id, list);
  }

  async function handleToggleStaff(app: AccessApplication, profile: GrantableProfile) {
    if (state.status !== "ready") return;
    const key = grantKey(app.id, profile.id);
    if (staffPending.has(key)) return;

    const existing = grants.find(
      (g) => g.application_id === app.id && g.profile_id === profile.id
    );

    setStaffPending((p) => new Set(p).add(key));
    try {
      if (existing) {
        await revokeAccess(existing.id);
      } else {
        await grantAccess(app.id, profile.id);
      }
      setToggledGrants(await fetchLiveGrants());
    } catch (e) {
      toast.error(
        e instanceof Error ? `Couldn't update access: ${e.message}` : "Couldn't update access."
      );
    } finally {
      setStaffPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleToggleCompany(app: AccessApplication, company: Company) {
    if (state.status !== "ready") return;
    const key = grantKey(app.id, company.id);
    if (companyPending.has(key)) return;

    const existing = companyGrants.find(
      (g) => g.application_id === app.id && g.company_id === company.id
    );

    setCompanyPending((p) => new Set(p).add(key));
    try {
      if (existing) {
        await revokeCompanyApplication(existing.id);
      } else {
        await grantCompanyApplication(company.id, app.id);
      }
      setToggledCompanyGrants(await fetchAllCompanyApplicationGrants());
    } catch (e) {
      toast.error(
        e instanceof Error ? `Couldn't update access: ${e.message}` : "Couldn't update access."
      );
    } finally {
      setCompanyPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  const filteredStaff = allStaff.filter((p) => {
    const q = staffFilter.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q);
  });
  const staffTotalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const staffCurrentPage = Math.min(staffPage, staffTotalPages);
  const pagedStaff = filteredStaff.slice(
    (staffCurrentPage - 1) * PAGE_SIZE,
    staffCurrentPage * PAGE_SIZE
  );

  const filteredCompanies = allCompanies.filter((c) => {
    const q = companyFilter.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q);
  });
  const companyTotalPages = Math.max(1, Math.ceil(filteredCompanies.length / PAGE_SIZE));
  const companyCurrentPage = Math.min(companyPage, companyTotalPages);
  const pagedCompanies = filteredCompanies.slice(
    (companyCurrentPage - 1) * PAGE_SIZE,
    companyCurrentPage * PAGE_SIZE
  );

  function onStaffFilterChange(value: string) {
    setStaffFilter(value);
    setStaffPage(1);
  }
  function onCompanyFilterChange(value: string) {
    setCompanyFilter(value);
    setCompanyPage(1);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="shrink-0">
        <PeopleSectionHeading
          label="Staff access"
          description="Tick the applications each staff member can open. Admins always see everything."
        />
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading access…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load access"
        errorHeadingLevel="h3"
        empty={false}
        emptyContent={null}
        className="glass mt-9 rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        <>
          <div className="mt-5">
            <Input
              type="search"
              value={staffFilter}
              onChange={(e) => onStaffFilterChange(e.target.value)}
              placeholder="Filter by name…"
              aria-label="Filter staff by name"
              className="max-w-sm border-ash/25 bg-void/40 text-bone"
            />
          </div>

          <div className="mt-4 rounded-sm border border-ash/20 bg-pine p-6 shadow-panel">
            <SurfaceState
              loading={false}
              loadingLabel=""
              error={null}
              empty={pagedStaff.length === 0}
              emptyContent={
                allStaff.length === 0 ? (
                  <>No staff to grant access to yet.</>
                ) : (
                  <>No one matches &quot;{staffFilter}&quot;.</>
                )
              }
              className="py-8 text-center text-sm text-ash"
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[640px] border-collapse text-left">
                  <TableCaption className="sr-only">Staff application access</TableCaption>
                  <TableHeader>
                    <TableRow className="border-ash/30 hover:bg-transparent">
                      <TableHead scope="col" className="h-auto px-0 py-3 text-label font-semibold uppercase tracking-[0.12em] text-ash">
                        Member
                      </TableHead>
                      {applications.map((app) => (
                        <TableHead key={app.id} scope="col" className="h-auto px-4 py-3 align-bottom">
                          <span className="block font-mono text-[11px] tracking-[0.08em] text-ash">
                            {app.reference}
                          </span>
                          <span className="mt-0.5 block max-w-[160px] truncate text-xs font-normal text-bone">
                            {app.title}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead scope="col" className="h-auto px-4 py-3 text-right text-label font-semibold uppercase tracking-[0.12em] text-ash">
                        Granted
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedStaff.map((profile) => {
                      const count = grants.filter((g) => g.profile_id === profile.id).length;
                      return (
                        <TableRow key={profile.id} className="border-ash/15 last:border-b-0">
                          <TableCell className="p-0 py-4 align-top">
                            <span className="block text-sm font-medium text-bone">{profile.name}</span>
                            <span className="block text-[11px] uppercase tracking-[0.1em] text-ash">
                              {profile.role}
                            </span>
                          </TableCell>
                          {applications.map((app) => {
                            const key = grantKey(app.id, profile.id);
                            const checked = grants.some(
                              (g) => g.application_id === app.id && g.profile_id === profile.id
                            );
                            const busy = staffPending.has(key);
                            return (
                              <TableCell key={app.id} className="p-0 px-4 py-4 align-top">
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={checked}
                                  aria-label={`${checked ? "Revoke" : "Grant"} ${profile.name}'s access to ${app.title}`}
                                  disabled={busy}
                                  onClick={() => handleToggleStaff(app, profile)}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 ${
                                    checked
                                      ? "border-signal bg-signal text-void"
                                      : "border-ash/30 bg-void/40 text-transparent hover:border-ash/60"
                                  }`}
                                >
                                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
                                    <path
                                      d="M2.5 6.5l2.5 2.5 4.5-5"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      fill="none"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              </TableCell>
                            );
                          })}
                          <TableCell className="p-0 px-4 py-4 text-right align-top text-sm font-light text-ash">
                            {count} of {applications.length}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </SurfaceState>
          </div>

          {filteredStaff.length > PAGE_SIZE && (
            <div className="mt-3 flex justify-end">
              <SimplePagination
                page={staffCurrentPage}
                totalPages={staffTotalPages}
                onPageChange={setStaffPage}
                label="staff access"
              />
            </div>
          )}
        </>
      </SurfaceState>

      <div className="mt-10 shrink-0">
        <PeopleSectionHeading
          label="Company access"
          description="Tick the applications each company's roster is in scope for. Checking a box automatically gives the company's current manager(s) live access — unchecking only narrows what's in scope going forward, it doesn't revoke access already granted."
        />
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel=""
        error={null}
        empty={false}
        emptyContent={null}
        className="mt-5"
      >
        <>
          <div className="mt-5">
            <Input
              type="search"
              value={companyFilter}
              onChange={(e) => onCompanyFilterChange(e.target.value)}
              placeholder="Filter by company name…"
              aria-label="Filter companies by name"
              className="max-w-sm border-ash/25 bg-void/40 text-bone"
            />
          </div>

          <div className="mt-4 rounded-sm border border-ash/20 bg-pine p-6 shadow-panel">
            <SurfaceState
              loading={false}
              loadingLabel=""
              error={null}
              empty={pagedCompanies.length === 0}
              emptyContent={
                allCompanies.length === 0 ? (
                  <>No companies yet — create one from the Companies page.</>
                ) : (
                  <>No companies match &quot;{companyFilter}&quot;.</>
                )
              }
              className="py-8 text-center text-sm text-ash"
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[640px] border-collapse text-left">
                  <TableCaption className="sr-only">Company application scope</TableCaption>
                  <TableHeader>
                    <TableRow className="border-ash/30 hover:bg-transparent">
                      <TableHead scope="col" className="h-auto px-0 py-3 text-label font-semibold uppercase tracking-[0.12em] text-ash">
                        Company
                      </TableHead>
                      {applications.map((app) => (
                        <TableHead key={app.id} scope="col" className="h-auto px-4 py-3 align-bottom">
                          <span className="block font-mono text-[11px] tracking-[0.08em] text-ash">
                            {app.reference}
                          </span>
                          <span className="mt-0.5 block max-w-[160px] truncate text-xs font-normal text-bone">
                            {app.title}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead scope="col" className="h-auto px-4 py-3 text-right text-label font-semibold uppercase tracking-[0.12em] text-ash">
                        In scope
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCompanies.map((company) => {
                      const count = companyGrants.filter((g) => g.company_id === company.id).length;
                      const managers = managersByCompany.get(company.id) ?? [];
                      return (
                        <TableRow key={company.id} className="border-ash/15 last:border-b-0">
                          <TableCell className="p-0 py-4 align-top">
                            <span className="block text-sm font-medium text-bone">{company.name}</span>
                            <span className="block text-[11px] text-ash">
                              {managers.length > 0 ? (
                                <>Managed by {managers.map((m) => m.name).join(", ")}</>
                              ) : (
                                <span className="text-amber">No manager assigned yet</span>
                              )}
                            </span>
                          </TableCell>
                          {applications.map((app) => {
                            const key = grantKey(app.id, company.id);
                            const checked = companyGrants.some(
                              (g) => g.application_id === app.id && g.company_id === company.id
                            );
                            const busy = companyPending.has(key);
                            return (
                              <TableCell key={app.id} className="p-0 px-4 py-4 align-top">
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={checked}
                                  aria-label={`${checked ? "Remove" : "Add"} ${app.title} ${checked ? "from" : "to"} ${company.name}'s scope`}
                                  disabled={busy}
                                  onClick={() => handleToggleCompany(app, company)}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 ${
                                    checked
                                      ? "border-signal bg-signal text-void"
                                      : "border-ash/30 bg-void/40 text-transparent hover:border-ash/60"
                                  }`}
                                >
                                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
                                    <path
                                      d="M2.5 6.5l2.5 2.5 4.5-5"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      fill="none"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              </TableCell>
                            );
                          })}
                          <TableCell className="p-0 px-4 py-4 text-right align-top text-sm font-light text-ash">
                            {count} of {applications.length}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </SurfaceState>
          </div>

          {filteredCompanies.length > PAGE_SIZE && (
            <div className="mt-3 flex justify-end">
              <SimplePagination
                page={companyCurrentPage}
                totalPages={companyTotalPages}
                onPageChange={setCompanyPage}
                label="company access"
              />
            </div>
          )}

          <p className="mt-3 text-xs text-ash">Administrators can always see every application.</p>
        </>
      </SurfaceState>
    </div>
  );
}
