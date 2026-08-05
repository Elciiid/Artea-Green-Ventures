"use client";

// Small company picker for the unassigned-clients section on the companies
// list page. A plain Dialog + filterable button list, not the shadcn
// Select — RoleChangeDialog already established (see its own header
// comment) that this app's one Select usage hit an unresolved
// containing-block/positioning bug, and a Dialog sidesteps that failure
// mode entirely rather than risking a second instance of it. The filter
// input exists because this list is exactly the thing the brief asked to
// scale past a handful of entries (companies), unlike RoleChangeDialog's
// fixed three-item role list.

import { useEffect, useState } from "react";
import type { Company } from "@/lib/supabase/companies";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AssignCompanyDialog({
  clientName,
  companies,
  open,
  onOpenChange,
  onConfirm,
}: {
  clientName: string | null;
  companies: Company[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (companyId: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setFilter("");
      setSelected(null);
    }
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (busy) return;
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!selected) return;
    setBusy(true);
    try {
      await onConfirm(selected);
    } finally {
      setBusy(false);
    }
  }

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-bone">
            Assign {clientName ?? "this client"} to a company
          </DialogTitle>
          <DialogDescription className="text-ash">
            Choose which company this client joins.
          </DialogDescription>
        </DialogHeader>

        <Input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter companies…"
          aria-label="Filter companies by name"
          className="border-ash/25 bg-void/40 text-bone"
        />

        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-ash">
              {companies.length === 0
                ? "No companies exist yet."
                : `No companies match "${filter}".`}
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Company</legend>
              {filtered.map((company) => (
                <label
                  key={company.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    selected === company.id
                      ? "border-signal bg-signal/10 text-bone"
                      : "border-ash/25 text-ash hover:border-ash/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="company"
                    value={company.id}
                    checked={selected === company.id}
                    onChange={() => setSelected(company.id)}
                    className="h-4 w-4 accent-signal"
                  />
                  <span className="font-semibold">{company.name}</span>
                </label>
              ))}
            </fieldset>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || !selected} onClick={handleConfirm}>
            {busy ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
