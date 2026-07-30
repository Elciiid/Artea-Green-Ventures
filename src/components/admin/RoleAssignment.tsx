"use client";

// Simple admin-only role picker: choose a person, choose a new role,
// confirm. The security boundary already existed (agv_prevent_self_role_
// escalation only lets an admin-initiated change through) — this is just
// the first UI that actually exposes it. Writes go through
// /api/admin/set-role (service-role-backed), never a direct client write —
// see src/lib/supabase/roles.ts and that route's file header for why.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@/lib/session";
import {
  fetchAllProfiles,
  setProfileRole,
  type ProfileForRoleAssignment,
} from "@/lib/supabase/roles";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ROLE_OPTIONS: Role[] = ["client", "staff", "admin"];

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profiles: ProfileForRoleAssignment[] };

export default function RoleAssignment() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState("");
  const [pendingRole, setPendingRole] = useState<Role | "">("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setState({ status: "loading" });
    try {
      const profiles = await fetchAllProfiles();
      setState({ status: "ready", profiles });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Couldn't load profiles.",
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const profiles = state.status === "ready" ? state.profiles : [];
  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  function onSelectProfile(id: string) {
    setSelectedId(id);
    setConfirming(false);
    const p = profiles.find((pr) => pr.id === id);
    setPendingRole(p ? p.role : "");
  }

  async function onConfirm() {
    if (!selected || !pendingRole) return;
    setBusy(true);
    try {
      await setProfileRole(selected.id, pendingRole);
      toast.success(`${selected.name} is now ${pendingRole}.`);
      setConfirming(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Role assignment"
      className="glass mt-9 rounded-2xl p-6 backdrop-blur-xl sm:p-7"
    >
      <h2 className="font-display text-lg font-bold text-bone">Role assignment</h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ash">
        Change what a person can access. Admin sees and manages everything;
        staff can edit applications they&apos;re granted; client is read-only.
      </p>

      {state.status === "loading" ? (
        <p role="status" className="mt-5 text-sm text-ash">
          Loading…
        </p>
      ) : state.status === "error" ? (
        <p className="mt-5 text-sm text-amber">{state.message}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 text-sm">
            <span className="block text-label font-semibold uppercase tracking-[0.12em] text-ash">
              Person
            </span>
            <Select value={selectedId} onValueChange={onSelectProfile}>
              <SelectTrigger className="mt-1.5 w-full border-ash/25 bg-void/40 text-bone">
                <SelectValue placeholder="Choose a person…" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 text-sm">
            <span className="block text-label font-semibold uppercase tracking-[0.12em] text-ash">
              New role
            </span>
            <Select
              value={pendingRole}
              disabled={!selected}
              onValueChange={(value) => {
                setPendingRole(value as Role);
                setConfirming(false);
              }}
            >
              <SelectTrigger className="mt-1.5 w-full border-ash/25 bg-void/40 text-bone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            disabled={!selected || !pendingRole || pendingRole === selected.role || busy}
            onClick={() => setConfirming(true)}
            className="rounded-full"
          >
            Change role
          </Button>
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="glass border-ash/20 bg-pine backdrop-blur-xl">
          {selected && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-bone">Confirm role change</AlertDialogTitle>
                <AlertDialogDescription className="text-ash">
                  Change <strong className="text-bone">{selected.name}</strong> from{" "}
                  <strong className="text-bone">{selected.role}</strong> to{" "}
                  <strong className="text-bone">{pendingRole}</strong>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    onConfirm();
                  }}
                >
                  {busy ? "Saving…" : "Confirm"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
