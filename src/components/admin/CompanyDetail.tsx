"use client";

// Per-company management (Task 2): roster (add/remove clients, with an
// explicit confirm before a silent reassignment), manager-status toggle for
// any number of roster members, and application scope — the last one reusing
// AccessMatrix's checkbox/grant visual pattern, applied to
// agv_company_applications instead of agv_application_access.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  fetchApplicationsForAccess,
  type AccessApplication,
} from "@/lib/supabase/access";
import {
  fetchClientProfiles,
  fetchCompanies,
  fetchCompany,
  fetchCompanyApplicationGrants,
  grantCompanyApplication,
  revokeCompanyApplication,
  setCompanyAssignment,
  type ClientProfile,
  type Company,
  type CompanyApplicationGrant,
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
import PeopleSectionHeading from "@/components/admin/PeopleSectionHeading";
import SurfaceState from "@/components/SurfaceState";

type DetailData = {
  company: Company | null;
  clients: ClientProfile[];
  companies: Company[];
  applications: AccessApplication[];
  grants: CompanyApplicationGrant[];
};

function loadDetail(companyId: string): Promise<DetailData> {
  return Promise.all([
    fetchCompany(companyId),
    fetchClientProfiles(),
    fetchCompanies(),
    fetchApplicationsForAccess(),
    fetchCompanyApplicationGrants(companyId),
  ]).then(([company, clients, companies, applications, grants]) => ({
    company,
    clients,
    companies,
    applications,
    grants,
  }));
}

export default function CompanyDetail({ companyId }: { companyId: string }) {
  const { state, refetch } = useAsyncResource(
    () => loadDetail(companyId),
    [companyId],
    "Something went wrong loading this company."
  );

  const [rosterFilter, setRosterFilter] = useState("");
  const [rosterBusy, setRosterBusy] = useState<Set<string>>(new Set());
  const [reassignTarget, setReassignTarget] = useState<{
    client: ClientProfile;
    currentCompanyName: string;
  } | null>(null);

  // Application-scope toggling re-reads only the live grants, matching
  // AccessMatrix's own narrower-than-a-full-reload pattern for the same
  // reason: a checkbox click shouldn't flash the whole surface's spinner.
  const [toggledGrants, setToggledGrants] = useState<CompanyApplicationGrant[] | null>(null);
  const [scopePending, setScopePending] = useState<Set<string>>(new Set());

  const company = state.status === "ready" ? state.data.company : null;
  const clients = state.status === "ready" ? state.data.clients : [];
  const companies = state.status === "ready" ? state.data.companies : [];
  const applications = state.status === "ready" ? state.data.applications : [];
  const grants = toggledGrants ?? (state.status === "ready" ? state.data.grants : []);

  const companiesById = new Map(companies.map((c) => [c.id, c] as const));
  const roster = clients.filter((c) => c.company_id === companyId);
  const candidates = clients
    .filter((c) => c.company_id !== companyId)
    .filter((c) => c.name.toLowerCase().includes(rosterFilter.trim().toLowerCase()));

  function busy(id: string) {
    return rosterBusy.has(id);
  }

  function withBusy<T>(id: string, fn: () => Promise<T>): Promise<T> {
    setRosterBusy((s) => new Set(s).add(id));
    return fn().finally(() => {
      setRosterBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    });
  }

  async function doAssign(client: ClientProfile) {
    await withBusy(client.id, async () => {
      try {
        // isCompanyManager: false is explicit on every company_id-changing
        // write here, whether this is a fresh assignment or a reassignment —
        // manager status was granted (if at all) for whichever company the
        // client is LEAVING, and carrying it forward silently into a new
        // company would hand out manager privileges nobody explicitly
        // decided on. The admin can re-grant it from this same roster once
        // the client is actually on it.
        await setCompanyAssignment(client.id, { companyId, isCompanyManager: false });
        toast.success(`${client.name} added to the roster.`);
        refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't add that client.");
      }
    });
  }

  function handleAddClick(client: ClientProfile) {
    if (client.company_id && client.company_id !== companyId) {
      const currentCompanyName = companiesById.get(client.company_id)?.name ?? "another company";
      setReassignTarget({ client, currentCompanyName });
      return;
    }
    void doAssign(client);
  }

  async function handleConfirmReassign() {
    const target = reassignTarget;
    setReassignTarget(null);
    if (target) await doAssign(target.client);
  }

  async function handleRemove(client: ClientProfile) {
    await withBusy(client.id, async () => {
      try {
        await setCompanyAssignment(client.id, { companyId: null, isCompanyManager: false });
        toast.success(`${client.name} removed from the roster.`);
        refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't remove that client.");
      }
    });
  }

  async function handleToggleManager(client: ClientProfile) {
    await withBusy(client.id, async () => {
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
      }
    });
  }

  async function handleToggleScope(app: AccessApplication) {
    if (scopePending.has(app.id)) return;
    const existing = grants.find((g) => g.application_id === app.id);
    setScopePending((s) => new Set(s).add(app.id));
    try {
      if (existing) {
        await revokeCompanyApplication(existing.id);
      } else {
        await grantCompanyApplication(companyId, app.id);
      }
      setToggledGrants(await fetchCompanyApplicationGrants(companyId));
    } catch (e) {
      toast.error(
        e instanceof Error ? `Couldn't update application scope: ${e.message}` : "Couldn't update application scope."
      );
    } finally {
      setScopePending((s) => {
        const next = new Set(s);
        next.delete(app.id);
        return next;
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <Link
        href="/admin/companies"
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash transition hover:text-signal"
      >
        ← Back to all companies
      </Link>

      <SurfaceState
        loading={state.status === "loading"}
        loadingLabel="Loading company…"
        error={state.status === "error" ? state.message : null}
        errorHeading="We couldn&apos;t load this company"
        empty={state.status === "ready" && company === null}
        emptyContent={
          <>
            <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
              We couldn&apos;t find this company
            </h2>
            <p className="mt-2 text-sm text-ash">
              Nothing matches that id. Check the link, or go back to all companies.
            </p>
          </>
        }
        className="glass mt-8 rounded-2xl py-16 text-center backdrop-blur-xl"
      >
        <>
          <div className="mt-6">
            <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
              Admin console
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
              {company?.name}
            </h1>
          </div>

          {/* ——— Roster ——— */}
          <div className="mt-10">
            <PeopleSectionHeading
              label="Roster"
              description="Clients on this company's account. Toggle manager to let someone grant or revoke access for their teammates."
            />

            <div className="mt-4">
              {roster.length === 0 ? (
                <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-ash backdrop-blur-xl">
                  No clients on this roster yet — add one below.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {roster.map((client) => (
                    <li
                      key={client.id}
                      className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 backdrop-blur-xl"
                    >
                      <span className="min-w-0 truncate font-display text-sm font-bold text-bone">
                        {client.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={client.is_company_manager}
                          aria-label={`${client.is_company_manager ? "Revoke" : "Grant"} manager status for ${client.name}`}
                          disabled={busy(client.id)}
                          onClick={() => handleToggleManager(client)}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label uppercase tracking-[0.1em] transition disabled:opacity-50 ${
                            client.is_company_manager
                              ? "border-signal bg-signal/15 text-signal"
                              : "border-ash/30 text-ash hover:border-ash/60"
                          }`}
                        >
                          Manager
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy(client.id)}
                          onClick={() => handleRemove(client)}
                        >
                          Remove
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6">
              <p className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
                Add a client
              </p>
              <div className="mt-3">
                <Input
                  type="search"
                  value={rosterFilter}
                  onChange={(e) => setRosterFilter(e.target.value)}
                  placeholder="Filter clients by name…"
                  aria-label="Filter clients to add"
                  className="max-w-sm border-ash/25 bg-void/40 text-bone"
                />
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="py-4 text-center text-sm text-ash">
                    {clients.length === 0
                      ? "No clients exist yet."
                      : rosterFilter
                        ? `No clients match "${rosterFilter}".`
                        : "Every other client is already on this roster."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {candidates.map((client) => {
                      const elsewhere = client.company_id !== null;
                      return (
                        <li
                          key={client.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-ash/20 px-3.5 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-bone">{client.name}</span>
                            {elsewhere && (
                              <span className="block text-xs text-ash">
                                Currently at {companiesById.get(client.company_id!)?.name ?? "another company"}
                              </span>
                            )}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy(client.id)}
                            onClick={() => handleAddClick(client)}
                          >
                            {busy(client.id) ? "Adding…" : elsewhere ? "Reassign…" : "Add"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ——— Application scope ——— */}
          <div className="mt-10">
            <PeopleSectionHeading
              label="Application scope"
              description="Which applications a manager may grant new access to for this company's roster — existing grants aren't affected by unchecking an application here. A manager can only grant their teammates access within this set."
            />
            <div className="mt-4">
              {applications.length === 0 ? (
                <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-ash backdrop-blur-xl">
                  No applications exist yet.
                </p>
              ) : (
                <ul className="glass flex flex-col gap-1 rounded-2xl px-4 py-3 backdrop-blur-xl">
                  {applications.map((app) => {
                    const checked = grants.some((g) => g.application_id === app.id);
                    const pending = scopePending.has(app.id);
                    return (
                      <li
                        key={app.id}
                        className="flex items-center justify-between gap-3 border-b border-ash/10 py-2 last:border-b-0"
                      >
                        <span className="min-w-0 text-sm">
                          <span className="block font-mono text-label tracking-[0.1em] text-ash">
                            {app.reference}
                          </span>
                          <span className="block truncate text-bone">{app.title}</span>
                        </span>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={`${checked ? "Remove" : "Add"} ${app.title} ${checked ? "from" : "to"} ${company?.name ?? "this company"}'s scope`}
                          disabled={pending}
                          onClick={() => handleToggleScope(app)}
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      </SurfaceState>

      <AlertDialog
        open={reassignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReassignTarget(null);
        }}
      >
        <AlertDialogContent className="glass backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone">
              Reassign {reassignTarget?.client.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ash">
              {reassignTarget?.client.name} currently belongs to{" "}
              {reassignTarget?.currentCompanyName}. A client can only belong to one
              company at a time, so adding them here moves them out of{" "}
              {reassignTarget?.currentCompanyName} and onto {company?.name}&apos;s
              roster. Their manager status (if any) is cleared, not carried over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReassign}>Reassign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
