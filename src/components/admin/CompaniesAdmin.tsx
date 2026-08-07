"use client";

// Companies admin — list page. Matches the reference's Companies page
// directly (docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md):
// a two-column layout, roster shown inline under each company (manager
// toggle + remove, both real — reuses setCompanyAssignment, unchanged),
// and a plain inline <select> to assign an unassigned client (no dialog —
// there's nothing to reassign FROM for a client whose company_id is
// already null, so the confirm-on-reassignment safety CompanyDetail.tsx
// still has for its own "add a client" flow doesn't apply here).
//
// Two real, flagged gaps against the reference's mockup:
//  - No "sector" per company — agv_companies has no such column; the
//    reference's is fake local state (Company.sector in portal-data.ts).
//    Not fabricated here.
//  - Delete is real, not the reference's free local-array filter: it's a
//    genuine DELETE against agv_companies, confirmed via AlertDialog first
//    (this codebase's established pattern for irreversible actions — see
//    the reassign-confirm dialog CompanyDetail.tsx already has). Postgres
//    itself rejects deleting a company that still has roster members (no
//    ON DELETE clause on agv_profiles.company_id — see deleteCompany's own
//    doc comment in companies.ts) rather than this trying to orchestrate a
//    clear-then-delete that could partially fail.
//
// Company creation is now a plain inline input + button in the page header
// (matching the reference exactly), not a modal — low-stakes enough
// (a name, freely correctable) that the modal this used to require wasn't
// pulling its weight.
//
// Application scope still lives on the per-company detail page
// (/admin/companies/[id]) — the reference has no equivalent concept at
// all, so there's nothing in its own Companies page to match structurally;
// each roster header links to "Manage scope →" for that.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import {
  createCompany,
  deleteCompany,
  fetchClientProfiles,
  fetchCompanies,
  setCompanyAssignment,
  type ClientProfile,
  type Company,
} from "@/lib/supabase/companies";
import { useAsyncResource } from "@/lib/useAsyncResource";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 10;

function loadCompaniesData(): Promise<{ companies: Company[]; clients: ClientProfile[] }> {
  return Promise.all([fetchCompanies(), fetchClientProfiles()]).then(([companies, clients]) => ({
    companies,
    clients,
  }));
}

export default function CompaniesAdmin() {
  const selfId = useSession((s) => s.account)?.id ?? null;
  const { state, refetch } = useAsyncResource(
    loadCompaniesData,
    [],
    "Something went wrong loading companies."
  );

  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [unassignedPage, setUnassignedPage] = useState(1);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const companies = state.status === "ready" ? state.data.companies : [];
  const clients = state.status === "ready" ? state.data.clients : [];
  const unassigned = clients.filter((c) => c.company_id === null);

  const rosterByCompany = new Map<string, ClientProfile[]>();
  for (const c of clients) {
    if (!c.company_id) continue;
    const roster = rosterByCompany.get(c.company_id) ?? [];
    roster.push(c);
    rosterByCompany.set(c.company_id, roster);
  }

  const filteredCompanies = companies.filter((c) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCompanies = filteredCompanies.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const unassignedTotalPages = Math.max(1, Math.ceil(unassigned.length / PAGE_SIZE));
  const unassignedCurrentPage = Math.min(unassignedPage, unassignedTotalPages);
  const pagedUnassigned = unassigned.slice(
    (unassignedCurrentPage - 1) * PAGE_SIZE,
    unassignedCurrentPage * PAGE_SIZE
  );

  function onFilterChange(value: string) {
    setFilter(value);
    setPage(1);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const company = await createCompany(name, selfId);
      toast.success(`${company.name} created.`);
      setNewName("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create that company.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignUnassigned(clientId: string, companyId: string) {
    const client = clients.find((c) => c.id === clientId);
    if (!client || !companyId) return;
    setBusyClientId(clientId);
    try {
      await setCompanyAssignment(clientId, { companyId, isCompanyManager: false });
      toast.success(`${client.name} assigned.`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't assign that client.");
    } finally {
      setBusyClientId(null);
    }
  }

  async function handleToggleManager(client: ClientProfile) {
    setBusyClientId(client.id);
    try {
      await setCompanyAssignment(client.id, { isCompanyManager: !client.is_company_manager });
      toast.success(
        client.is_company_manager
          ? `${client.name} is no longer a manager.`
          : `${client.name} is now a manager.`
      );
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change manager status.");
    } finally {
      setBusyClientId(null);
    }
  }

  async function handleRemoveFromRoster(client: ClientProfile) {
    setBusyClientId(client.id);
    try {
      await setCompanyAssignment(client.id, { companyId: null, isCompanyManager: false });
      toast.success(`${client.name} removed from the roster.`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove that client.");
    } finally {
      setBusyClientId(null);
    }
  }

  // Radix's AlertDialogAction closes the dialog itself on click, same as
  // every other AlertDialog in this app (see CompanyDetail.tsx's
  // handleConfirmReassign) — fighting that by keeping the dialog open
  // across the await left it stuck open with a blank title mid-delete.
  // Capture the target and let the dialog close immediately; the toast is
  // the real feedback for success or failure, not a lingering open dialog.
  async function handleConfirmDelete() {
    const company = deleteTarget;
    setDeleteTarget(null);
    if (!company) return;
    try {
      await deleteCompany(company.id);
      toast.success(`${company.name} deleted.`);
      refetch();
    } catch (e) {
      // The real, expected failure: Postgres rejects the delete while
      // roster members still reference this company (no ON DELETE clause
      // on agv_profiles.company_id — see deleteCompany's own doc comment).
      toast.error(
        e instanceof Error && /foreign key/i.test(e.message)
          ? `Remove everyone from ${company.name}'s roster before deleting it.`
          : e instanceof Error
            ? e.message
            : "Couldn't delete that company."
      );
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-signal">Admin console</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-bone sm:text-5xl">
            Companies
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-ash">
            Group client contacts under the organisation they represent, and nominate who
            manages the relationship.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim() && !creating) handleCreate();
            }}
            placeholder="New company name"
            aria-label="New company name"
            className="h-10 w-52 rounded-full border-ash/25 bg-pine text-sm"
          />
          <Button
            type="button"
            disabled={creating || !newName.trim()}
            onClick={handleCreate}
            className="rounded-full"
          >
            {creating ? "Creating…" : "New company"}
          </Button>
        </div>
      </div>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading companies…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load companies"
        empty={false}
        emptyContent={null}
        className="glass mt-9 rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        <div className="mt-9 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-sm border border-ash/20 bg-pine p-6 shadow-panel">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="eyebrow text-ash">Companies</h2>
                <p className="mt-1 text-xs font-light text-ash">
                  {filteredCompanies.length} organisation{filteredCompanies.length === 1 ? "" : "s"} on record
                </p>
              </div>
              <Input
                type="search"
                value={filter}
                onChange={(e) => onFilterChange(e.target.value)}
                placeholder="Filter by name…"
                aria-label="Filter companies by name"
                className="h-9 w-48 rounded-full border-ash/25 bg-void/40 text-sm"
              />
            </div>

            <SurfaceState
              loading={false}
              loadingLabel=""
              error={null}
              empty={pagedCompanies.length === 0}
              emptyContent={
                companies.length === 0 ? (
                  <>No companies yet — create the first one above.</>
                ) : (
                  <>No companies match &quot;{filter}&quot;.</>
                )
              }
              className="py-8 text-center text-sm text-ash"
            >
              <ul className="space-y-3">
                {pagedCompanies.map((company) => {
                  const roster = rosterByCompany.get(company.id) ?? [];
                  return (
                    <li key={company.id} className="rounded-sm border border-ash/15 bg-void/30 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-bone">{company.name}</p>
                          <p className="text-xs font-light text-ash">
                            {roster.length} client{roster.length === 1 ? "" : "s"} ·{" "}
                            <Link
                              href={`/admin/companies/${company.id}`}
                              className="underline decoration-ash/40 decoration-1 underline-offset-4 hover:decoration-signal"
                            >
                              Manage scope →
                            </Link>
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => setDeleteTarget(company)}
                        >
                          Delete
                        </Button>
                      </div>

                      {roster.length ? (
                        <ul className="mt-4 space-y-2">
                          {roster.map((member) => (
                            <li
                              key={member.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-pine px-4 py-2.5"
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal/15 text-[11px] font-semibold text-signal">
                                  {member.name.charAt(0).toUpperCase()}
                                </span>
                                <p className="text-sm text-bone">{member.name}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={member.is_company_manager}
                                  aria-label={`${member.is_company_manager ? "Revoke" : "Grant"} manager status for ${member.name}`}
                                  disabled={busyClientId === member.id}
                                  onClick={() => handleToggleManager(member)}
                                  className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                                    member.is_company_manager
                                      ? "border-signal bg-signal text-void"
                                      : "border-ash/30 text-ash hover:border-ash/60"
                                  }`}
                                >
                                  Manager
                                </button>
                                <button
                                  type="button"
                                  disabled={busyClientId === member.id}
                                  onClick={() => handleRemoveFromRoster(member)}
                                  className="text-xs font-light text-ash transition hover:text-destructive disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-4 text-xs font-light text-ash">No clients assigned yet.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SurfaceState>

            {filteredCompanies.length > PAGE_SIZE && (
              <div className="mt-3 flex justify-end">
                <SimplePagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  label="the company list"
                />
              </div>
            )}
          </div>

          <div className="rounded-sm border border-ash/20 bg-pine p-6 shadow-panel">
            <h2 className="eyebrow text-ash">Unassigned clients</h2>
            <p className="mt-1 text-xs font-light text-ash">
              Assign a client to place them under a company.
            </p>

            <div className="mt-4">
              {unassigned.length === 0 ? (
                <p className="text-sm font-light text-ash">Every client belongs to a company.</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {pagedUnassigned.map((client) => (
                      <li key={client.id} className="rounded-sm border border-ash/15 bg-void/30 p-4">
                        <p className="text-sm font-medium text-bone">{client.name}</p>
                        <select
                          value=""
                          disabled={busyClientId === client.id}
                          onChange={(e) => {
                            if (e.target.value) handleAssignUnassigned(client.id, e.target.value);
                          }}
                          aria-label={`Assign ${client.name} to a company`}
                          className="mt-3 h-9 w-full rounded-md border border-ash/25 bg-pine px-3 text-sm text-bone outline-none focus:border-signal disabled:opacity-50"
                        >
                          <option value="">Assign to company…</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                  {unassigned.length > PAGE_SIZE && (
                    <div className="mt-3 flex justify-end">
                      <SimplePagination
                        page={unassignedCurrentPage}
                        totalPages={unassignedTotalPages}
                        onPageChange={setUnassignedPage}
                        label="unassigned clients"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </SurfaceState>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="glass backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone">
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ash">
              This permanently deletes the company and its application-scope
              grants. It's rejected if anyone is still on its roster — remove
              them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
