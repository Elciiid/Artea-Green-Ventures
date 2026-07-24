"use client";

// Admin-only "Invite client" control, shown on one application's detail
// page. Calls /api/admin/invite-client, which independently re-verifies
// admin status server-side (see that route) — this component doesn't do
// any authorization itself, only UI. Placement rationale is in STATUS.md.

import { useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function InviteClientForm({
  applicationId,
  applicationReference,
}: {
  applicationId: string;
  applicationReference: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }

    setBusy(true);
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      if (!session) {
        setError("Your session has expired — sign in again.");
        setBusy(false);
        return;
      }

      const res = await fetch("/api/admin/invite-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: trimmed, applicationId }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      setDone(
        `Invited ${trimmed} — they'll get an email to set their password, and will see ${applicationReference} once they sign in.`
      );
      setEmail("");
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-ash/30 px-4 py-2 text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:border-signal/60 hover:text-signal"
      >
        Invite client
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-ash/15 bg-pine/40 p-5">
      <p className="text-sm text-bone">
        Invite a new client and grant them {applicationReference} in one step.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="invite-email"
            className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
          >
            Client email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="client@theirdomain.com"
            className="mt-1.5 w-full rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-signal px-4 py-2.5 font-display text-sm font-bold text-void transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
              setDone(null);
            }}
            disabled={busy}
            className="rounded-md border border-ash/30 px-4 py-2.5 text-sm text-ash transition hover:text-bone disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-amber">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-contour">
          {done}
        </p>
      )}
    </form>
  );
}
