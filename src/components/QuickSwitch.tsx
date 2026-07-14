"use client";

import { useRouter } from "next/navigation";
import { nextAccount, roleHome, useSession } from "@/lib/session";

/** Cycles through the demo accounts (admin → user1 → user2 → …) for demos. */
export default function QuickSwitch() {
  const account = useSession((s) => s.account);
  const switchAccount = useSession((s) => s.switchAccount);
  const router = useRouter();

  if (!account) return null;
  const target = nextAccount(account);

  return (
    <button
      type="button"
      onClick={() => {
        const next = switchAccount();
        if (next) router.push(roleHome(next.role));
      }}
      title="Switch demo account"
      className="inline-flex items-center gap-2 rounded-full border border-ash/25 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition hover:border-signal/60 hover:text-signal"
    >
      <span aria-hidden>⇄</span>
      View as {target.name}
    </button>
  );
}
