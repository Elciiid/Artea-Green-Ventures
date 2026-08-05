"use client";

// Companies admin — list page (Task 2). Reuses AccessMatrix's proven
// filter-Input + SimplePagination pattern for the company list itself (the
// brief was explicit this needs to scale past a handful of companies), plus
// a create-company dialog and the unassigned-clients section, whose "assign
// directly from this page" action is the whole point of surfacing it here
// rather than as a follow-up.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import {
  createCompany,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import AssignCompanyDialog from "@/components/admin/AssignCompanyDialog";
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SimplePagination from "@/components/admin/SimplePagination";
import SurfaceState from "@/components/SurfaceState";

const PAGE_SIZE = 8;

function loadCompaniesData(): Promise<{ companies: Company[]; clients: ClientProfile[] }> {
  return Promise.all([fetchCompanies(), fetchClientProfiles()]).then(([companies, clients]) => ({
    companies,
    clients,
  }));
}

export default function CompaniesAdmin() {
  const router = useRouter();
  const selfId = useSession((s) => s.account)?.id ?? null;
  const { state, refetch } = useAsyncResource(
    loadCompaniesData,
    [],
    "Something went wrong loading companies."
  );

  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [assignTarget, setAssignTarget] = useState<ClientProfile | null>(null);
  const [assigning, setAssigning] = useState<Set<string>>(new Set());

  const companies = state.status === "ready" ? state.data.companies : [];
  const clients = state.status === "ready" ? state.data.clients : [];
  const unassigned = clients.filter((c) => c.company_id === null);

  const rosterCounts = new Map<string, number>();
  for (const c of clients) {
    if (c.company_id) rosterCounts.set(c.company_id, (rosterCounts.get(c.company_id) ?? 0) + 1);
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
      setCreateOpen(false);
      setNewName("");
      router.push(`/admin/companies/${company.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create that company.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignUnassigned(companyId: string) {
    if (!assignTarget) return;
    const client = assignTarget;
    setAssigning((s) => new Set(s).add(client.id));
    try {
      // isCompanyManager: false is explicit, not just "leave unset" — this
      // client was unassigned a moment ago, so it's already false in
      // practice, but pinning it here keeps every company_id-changing write
      // in this file paired with an explicit manager-status decision rather
      // than relying on it happening to already be correct.
      await setCompanyAssignment(client.id, { companyId, isCompanyManager: false });
      toast.success(`${client.name} assigned.`);
      setAssignTarget(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't assign that client.");
    } finally {
      setAssigning((s) => {
        const next = new Set(s);
        next.delete(client.id);
        return next;
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
            Admin console
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
            Companies
          </h1>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          New company
        </Button>
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
        <>
          <div className="mt-9">
            <PeopleSectionHeading
              label="Companies"
              description="Every client company. Click one to manage its roster and application scope."
            />

            <div className="mt-4">
              <Input
                type="search"
                value={filter}
                onChange={(e) => onFilterChange(e.target.value)}
                placeholder="Filter by name…"
                aria-label="Filter companies by name"
                className="max-w-sm border-ash/25 bg-void/40 text-bone"
              />
            </div>

            <div className="mt-4">
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
                errorHeadingLevel="h3"
                className="glass rounded-2xl py-8 text-center text-sm text-ash backdrop-blur-xl"
              >
                <ul className="flex flex-col gap-2">
                  {pagedCompanies.map((company) => {
                    const count = rosterCounts.get(company.id) ?? 0;
                    return (
                      <li key={company.id}>
                        <Link
                          href={`/admin/companies/${company.id}`}
                          className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 backdrop-blur-xl transition hover:ring-1 hover:ring-signal/40"
                        >
                          <span className="font-display text-sm font-bold text-bone">
                            {company.name}
                          </span>
                          <span className="text-label uppercase tracking-[0.1em] text-ash">
                            {count} {count === 1 ? "client" : "clients"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </SurfaceState>
            </div>

            <div className="mt-3 flex justify-end">
              <SimplePagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                label="the company list"
              />
            </div>
          </div>

          <div className="mt-10">
            <PeopleSectionHeading
              label="Unassigned clients"
              description="Clients with no company yet. Assign each one directly here — this is the only place that decision gets made."
            />
            <div className="mt-4">
              {unassigned.length === 0 ? (
                <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-ash backdrop-blur-xl">
                  Every client is assigned to a company.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {unassigned.map((client) => (
                    <li
                      key={client.id}
                      className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 backdrop-blur-xl"
                    >
                      <span className="font-display text-sm font-bold text-bone">
                        {client.name}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={assigning.has(client.id)}
                        onClick={() => setAssignTarget(client)}
                      >
                        {assigning.has(client.id) ? "Assigning…" : "Assign to company…"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      </SurfaceState>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (creating) return;
          setCreateOpen(open);
          if (!open) setNewName("");
        }}
      >
        <DialogContent className="glass backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-bone">New company</DialogTitle>
            <DialogDescription className="text-ash">
              Name only — clients and application scope are assigned after
              it&apos;s created.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Company name"
            aria-label="Company name"
            className="border-ash/25 bg-void/40 text-bone"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim() && !creating) handleCreate();
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={creating || !newName.trim()} onClick={handleCreate}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignCompanyDialog
        clientName={assignTarget?.name ?? null}
        companies={companies}
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
        onConfirm={handleAssignUnassigned}
      />
    </div>
  );
}
