"use client";

// Dev-only account quick-switcher. Re-authenticates as the next seed account
// using the shared dev seed password (real Supabase sign-in, not a fake
// session). Because that's a real auth bypass, visibility is fail-safe: hidden
// by default, shown only when showDevTools() positively confirms non-production
// (see its definition in session.ts).
//
// Note (Phase 10a): switcher usage can't be audit-logged yet — the audit
// trail arrives in Phase 13. That's an accepted interim gap for a dev-only
// tool, not something to half-solve here with ad hoc logging.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nextAccount, roleHome, showDevTools, useSession } from "@/lib/session";

export default function QuickSwitch() {
  const account = useSession((s) => s.account);
  const switchAccount = useSession((s) => s.switchAccount);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!showDevTools() || !account) return null;
  const target = nextAccount({ email: account.email });

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = await switchAccount();
        setBusy(false);
        if (!error) router.push(roleHome(target.role));
      }}
      title="Dev only — sign in as a different seed account"
      className="inline-flex items-center gap-2 rounded-full border border-ash/25 px-3.5 py-1.5 text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:border-signal/60 hover:text-signal disabled:opacity-50"
    >
      <span aria-hidden>⇄</span>
      {busy ? "Switching…" : `Switch to ${target.name}`}
    </button>
  );
}
