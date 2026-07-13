"use client";

// Shared shell for /admin and /portal: header, footer, faint terrain band,
// and the mock role guard (redirects to login / the correct home).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { roleHome, useSession, type Role } from "@/lib/session";
import { Wordmark } from "@/components/Logo";
import QuickSwitch from "@/components/QuickSwitch";
import TopoField from "@/components/TopoField";

// The role chip is informational, not clickable — kept neutral so Signal
// stays exclusive to interactive elements (and Contour to resolved states).

export default function AppShell({
  expect,
  children,
}: {
  expect: Role;
  children: React.ReactNode;
}) {
  const account = useSession((s) => s.account);
  const hydrated = useSession((s) => s.hydrated);
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!account) router.replace("/");
    else if (account.role !== expect) router.replace(roleHome(account.role));
  }, [hydrated, account, expect, router]);

  // Blank frame while the persisted session restores or a redirect is pending.
  if (!hydrated || !account || account.role !== expect) {
    return <div aria-hidden className="min-h-dvh bg-void" />;
  }

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <TopoField />
      </div>

      <header className="relative z-10 border-b border-ash/10 bg-void/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6">
          <Link href={roleHome(account.role)} className="shrink-0">
            <Wordmark hideTagOnMobile />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden font-mono text-[11px] text-ash lg:inline">
              {account.name} · {account.org}
            </span>
            <span className="hidden rounded-full border border-ash/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-bone sm:inline-block">
              {account.role}
            </span>
            <QuickSwitch />
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/");
              }}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition hover:text-bone"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-14">
        {children}
      </main>

      <footer className="relative z-10 border-t border-ash/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash/70 sm:flex-row sm:justify-between">
          <span>© 2026 Artea Green Ventures</span>
          <span>Demo environment — mock data only</span>
        </div>
      </footer>
    </div>
  );
}
