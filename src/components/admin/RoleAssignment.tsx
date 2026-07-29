"use client";

// Simple admin-only role picker: choose a person, choose a new role,
// confirm. The security boundary already existed (agv_prevent_self_role_
// escalation only lets an admin-initiated change through) — this is just
// the first UI that actually exposes it. Writes go through
// /api/admin/set-role (service-role-backed), never a direct client write —
// see src/lib/supabase/roles.ts and that route's file header for why.

import { useEffect, useState } from "react";
import type { Role } from "@/lib/session";
import {
  fetchAllProfiles,
  setProfileRole,
  type ProfileForRoleAssignment,
} from "@/lib/supabase/roles";

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
  const [toast, setToast] = useState<string | null>(null);

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
      setToast(`${selected.name} is now ${pendingRole}.`);
      setConfirming(false);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn't change role.");
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
          <label className="flex-1 text-sm">
            <span className="block text-label font-semibold uppercase tracking-[0.12em] text-ash">
              Person
            </span>
            <select
              value={selectedId}
              onChange={(e) => onSelectProfile(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-ash/25 bg-void/40 px-3 py-2 text-sm text-bone"
            >
              <option value="">Choose a person…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.role}
                </option>
              ))}
            </select>
          </label>

          <label className="flex-1 text-sm">
            <span className="block text-label font-semibold uppercase tracking-[0.12em] text-ash">
              New role
            </span>
            <select
              value={pendingRole}
              disabled={!selected}
              onChange={(e) => {
                setPendingRole(e.target.value as Role);
                setConfirming(false);
              }}
              className="mt-1.5 w-full rounded-lg border border-ash/25 bg-void/40 px-3 py-2 text-sm text-bone disabled:opacity-50"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!selected || !pendingRole || pendingRole === selected.role || busy}
            onClick={() => setConfirming(true)}
            className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-void transition hover:brightness-110 disabled:opacity-50"
          >
            Change role
          </button>
        </div>
      )}

      {confirming && selected && (
        <div
          role="alertdialog"
          aria-label="Confirm role change"
          className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3"
        >
          <p className="text-sm text-bone">
            Change <strong>{selected.name}</strong> from{" "}
            <strong>{selected.role}</strong> to <strong>{pendingRole}</strong>?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-full bg-signal px-4 py-1.5 text-xs font-semibold text-void disabled:opacity-50"
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-ash/30 px-4 py-1.5 text-xs text-ash"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <p role="status" aria-live="polite" className="mt-4 text-xs text-ash">
          {toast}
        </p>
      )}
    </section>
  );
}
