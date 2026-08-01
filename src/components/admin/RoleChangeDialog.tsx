"use client";

// Role-change control for the Directory tab's person cards. Deliberately a
// Dialog with a plain radio group, not a floating Select/popover — the only
// Select usage in this app (the old person/role pickers this replaces) was
// the one instance of a still-unresolved containing-block/positioning bug
// class; a Dialog sidesteps that failure mode rather than trying to fix
// positioning. Role-change write is unchanged: setProfileRole (this file's
// caller supplies onConfirm, wired to the exact same call RoleAssignment
// used).

import { useState, useEffect } from "react";
import type { Role } from "@/lib/session";
import type { ProfileForRoleAssignment } from "@/lib/supabase/roles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ROLE_OPTIONS: Role[] = ["client", "staff", "admin"];

export default function RoleChangeDialog({
  person,
  open,
  onOpenChange,
  onConfirm,
}: {
  person: ProfileForRoleAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (role: Role) => Promise<void>;
}) {
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && person) setPendingRole(person.role);
  }, [open, person]);

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (next && person) setPendingRole(person.role);
    if (!next) setPendingRole(null);
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!pendingRole) return;
    setBusy(true);
    try {
      await onConfirm(pendingRole);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass backdrop-blur-xl">
        {person && (
          <>
            <DialogHeader>
              <DialogTitle className="text-bone">Change {person.name}&apos;s role</DialogTitle>
              <DialogDescription className="text-ash">
                Admin sees and manages everything; staff can edit applications
                they&apos;re granted; client is read-only.
              </DialogDescription>
            </DialogHeader>

            <fieldset className="mt-2 flex flex-col gap-2">
              <legend className="sr-only">New role for {person.name}</legend>
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    pendingRole === role
                      ? "border-signal bg-signal/10 text-bone"
                      : "border-ash/25 text-ash hover:border-ash/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={pendingRole === role}
                    onChange={() => setPendingRole(role)}
                    className="h-4 w-4 accent-signal"
                  />
                  <span className="font-semibold capitalize">{role}</span>
                  {role === person.role && (
                    <span className="text-xs text-ash">(current)</span>
                  )}
                </label>
              ))}
            </fieldset>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || !pendingRole || pendingRole === person.role}
                onClick={handleConfirm}
              >
                {busy ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
