"use client";

// Shared shell for every signed-in surface (/admin, /portal, /account).
//
// Phase 10c moved navigation from a crowded header into a left SIDEBAR. The
// header was already carrying the masthead, a role chip, DisplaySettings, the
// dev switcher, sign-out, and a second row of admin tabs — and this phase adds
// Account settings with an audit trail (Phase 13) due right after. A sidebar
// absorbs new destinations by growing vertically (cheap) instead of packing a
// single header row horizontally (crowded), and separates three things that
// were tangled together: section navigation (sidebar), page-agnostic display
// chrome (DisplaySettings — stays a top-bar popover because it must also work
// pre-login), and identity/session actions (sidebar footer).
//
// `expect` is optional: pass a role to guard a role-specific surface, omit it
// for shared surfaces like /account that any signed-in person may reach.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { roleHome, showDevTools, useSession, type Role } from "@/lib/session";
import { useApplications } from "@/lib/applications";
import { Wordmark } from "@/components/Logo";
import DisplaySettings from "@/components/DisplaySettings";
import QuickSwitch from "@/components/QuickSwitch";
import TopoField from "@/components/TopoField";

type NavItem = { href: string; label: string; match: (p: string) => boolean };

// The register tab is active for the role's home and any of its application
// detail routes; only the access route lights "User access".
function recordsNav(role: Role): NavItem[] {
  return role === "admin"
    ? [
        {
          href: "/admin",
          label: "Applications",
          match: (p) => p === "/admin" || p.startsWith("/admin/applications"),
        },
        {
          href: "/admin/access",
          label: "User access",
          match: (p) => p.startsWith("/admin/access"),
        },
      ]
    : [
        {
          href: "/portal",
          label: "Applications",
          match: (p) => p === "/portal" || p.startsWith("/portal/applications"),
        },
      ];
}

const ACCOUNT_ITEM: NavItem = {
  href: "/account",
  label: "Account",
  match: (p) => p.startsWith("/account"),
};

export default function AppShell({
  expect,
  children,
}: {
  expect?: Role | Role[];
  children: React.ReactNode;
}) {
  const account = useSession((s) => s.account);
  const hydrated = useSession((s) => s.hydrated);
  const signOut = useSession((s) => s.signOut);
  const resetDemo = useApplications((s) => s.resetDemo);
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const allowedRoles = expect === undefined ? null : Array.isArray(expect) ? expect : [expect];

  useEffect(() => {
    if (!hydrated) return;
    if (!account) {
      router.replace("/");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(account.role)) router.replace(roleHome(account.role));
  }, [hydrated, account, allowedRoles, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Shown while the persisted session restores or a redirect is pending.
  if (!hydrated || !account || (allowedRoles && !allowedRoles.includes(account.role))) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-void px-6">
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 text-sm text-ash"
        >
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
          />
          Loading AGV Portal…
        </p>
      </div>
    );
  }

  const nav = recordsNav(account.role);

  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* mobile drawer backdrop */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-void/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ——— sidebar ——— (an <aside> landmark so its masthead + identity/
          session footer aren't orphaned outside any region; the distinct
          aria-label keeps it unique against the demo banner's complementary
          landmark) */}
      <aside
        id="primary-sidebar"
        aria-label="Account and navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ash/15 bg-pine/40 backdrop-blur-md transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:bg-pine/20 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* thin masthead accent rule — a small letterhead cue */}
        <div aria-hidden className="h-0.5 bg-signal/70" />
        <div className="flex h-16 items-center px-5">
          <Link href={roleHome(account.role)} className="shrink-0">
            <Wordmark hideTagOnMobile />
          </Link>
        </div>

        <nav aria-label="Primary" className="flex flex-col gap-0.5 px-3">
          <SideGroupLabel>Records</SideGroupLabel>
          {nav.map((item) => (
            <SideLink key={item.href} item={item} active={item.match(pathname)} />
          ))}
          <SideGroupLabel>You</SideGroupLabel>
          <SideLink item={ACCOUNT_ITEM} active={ACCOUNT_ITEM.match(pathname)} />
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-ash/15 px-5 py-4">
          <div>
            <p className="text-sm text-bone">{account.name}</p>
            <p className="mt-1.5 inline-block rounded-full border border-ash/40 px-2.5 py-0.5 text-label uppercase tracking-[0.14em] text-ash">
              {account.role}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2.5">
            {/* dev-only; QuickSwitch self-hides via showDevTools() */}
            <QuickSwitch />
            {/* Reset demo data is now gated behind showDevTools(). Once Phase
                10b makes the data real, an ungated reset in production could
                destroy live records; keeping it fail-safe (hidden unless we can
                confirm non-production) is the same guard as the dev switcher.
                Also admin-only, as before. */}
            {showDevTools() && account.role === "admin" && (
              <button
                type="button"
                onClick={resetDemo}
                title="Undo every change and put the demo back to how it started"
                className="text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:text-amber"
              >
                Reset demo data
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:text-bone"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ——— right column ——— */}
      <div className="relative flex min-h-dvh flex-col">
        {/* faint terrain band — kept quiet so it reads as letterhead texture */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <TopoField />
        </div>

        <header className="relative z-10 flex h-16 items-center gap-3 border-b border-ash/15 bg-void/70 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="primary-sidebar"
            className="inline-flex items-center justify-center rounded-md border border-ash/25 p-2 text-ash transition hover:border-signal/60 hover:text-signal lg:hidden"
          >
            <svg
              aria-hidden
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M2 4.5h14M2 9h14M2 13.5h14" />
            </svg>
          </button>
          <div className="flex-1" />
          <DisplaySettings />
        </header>

        <main
          id="main-content"
          className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 pb-24 pt-12 sm:px-8"
        >
          {children}
        </main>

        <footer className="relative z-10 border-t border-ash/15">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-display text-sm font-bold text-bone">
                  Artea Green Ventures
                </p>
                <p className="mt-1 text-xs text-ash">
                  Environmental compliance · Australia &amp; the Philippines
                </p>
              </div>
              <div className="text-xs text-ash sm:text-right">
                {/* gated on showDevTools() for consistency with the login
                    "Demo build" chip — the "illustrative, not official" notice
                    must not linger over real records in production */}
                {showDevTools() && (
                  <p>Demo environment — records shown are illustrative, not official.</p>
                )}
                <p className="mt-1">© 2026 Artea Green Ventures</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SideGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-label font-semibold uppercase tracking-[0.14em] text-ash">
      {children}
    </p>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md border-l-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-signal bg-signal/10 text-signal"
          : "border-transparent text-ash hover:bg-void/40 hover:text-bone"
      }`}
    >
      {item.label}
    </Link>
  );
}
