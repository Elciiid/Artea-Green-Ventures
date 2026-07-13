"use client";

import { useRouter } from "next/navigation";
import { roleHome, useSession } from "@/lib/session";

/** One-click role toggle for demos — swaps the session and routes to the other home. */
export default function QuickSwitch() {
  const account = useSession((s) => s.account);
  const switchRole = useSession((s) => s.switchRole);
  const router = useRouter();

  if (!account) return null;
  const target = account.role === "admin" ? "client" : "admin";

  return (
    <button
      type="button"
      onClick={() => {
        const next = switchRole();
        if (next) router.push(roleHome(next.role));
      }}
      className="inline-flex items-center gap-2 rounded-full border border-ash/25 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition hover:border-signal/60 hover:text-signal"
    >
      <span aria-hidden>⇄</span>
      View as {target}
    </button>
  );
}
