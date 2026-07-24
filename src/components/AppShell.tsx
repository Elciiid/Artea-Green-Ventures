"use client";

// Shared shell for every signed-in surface (/admin, /portal, /account, /home).
//
// Phase 19: replaced the Phase 10c left sidebar with a top pill-nav, per a
// reference composition the user provided (an EV-charger product page) that
// explicitly asked for the sidebar to be replaced, not just Home's content
// restyled — confirmed directly rather than assumed, since it contradicted
// Phase 18's earlier "sidebar, Home primary" decision. Applies app-wide, not
// just to Home, so every role-gated page shares one nav pattern instead of
// two competing ones.
//
// `expect` is optional: pass a role to guard a role-specific surface, omit it
// for shared surfaces like /account that any signed-in person may reach.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { roleHome, showDevTools, useSession, type Role } from "@/lib/session";
import { useApplications } from "@/lib/applications";
import { Wordmark } from "@/components/Logo";
import QuickSwitch from "@/components/QuickSwitch";

type NavItem = { href: string; label: string; match: (p: string) => boolean };

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

// Home is only ever shown for admin/staff — "client gets no Home hub at
// all" is a locked decision (see the `role !== "client"` check below).
const HOME_ITEM: NavItem = {
  href: "/home",
  label: "Home",
  match: (p) => p === "/home" || p.startsWith("/home/"),
};

// Only surfaced in the Menu dropdown, not the desktop pill nav — Directory
// is already reachable from Home's tile row, so it doesn't need a top-level
// slot next to Home/Applications, but the Menu is a reasonable second path
// to it now that the hero photo no longer links there directly.
const DIRECTORY_ITEM: NavItem = {
  href: "/home/directory",
  label: "Staff directory",
  match: (p) => p.startsWith("/home/directory"),
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const allowedRoles = expect === undefined ? null : Array.isArray(expect) ? expect : [expect];

  useEffect(() => {
    if (!hydrated) return;
    if (!account) {
      router.replace("/");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(account.role)) router.replace(roleHome(account.role));
  }, [hydrated, account, allowedRoles, router]);

  // Close both menus whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  // Escape closes whichever menu is open.
  useEffect(() => {
    if (!mobileNavOpen && !accountMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, accountMenuOpen]);

  // Click outside the account dropdown closes it.
  useEffect(() => {
    if (!accountMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountMenuOpen]);

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
          Loading AGV Home…
        </p>
      </div>
    );
  }

  const nav = account.role === "client" ? recordsNav(account.role) : [HOME_ITEM, ...recordsNav(account.role)];
  const menuNav = account.role === "client" ? nav : [...nav, DIRECTORY_ITEM];

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href={roleHome(account.role)} className="flex shrink-0 items-center">
              <Wordmark hideTagOnMobile />
            </Link>

            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileNavOpen}
                aria-haspopup="menu"
                aria-controls="mobile-nav-panel"
                className="inline-flex items-center gap-2 rounded-full border border-ash/25 px-3.5 py-1.5 text-sm text-ash transition hover:border-signal/50 hover:text-bone"
              >
                <svg aria-hidden width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M2 4.5h14M2 9h14M2 13.5h14" />
                </svg>
                Menu
              </button>

              {/* Anchored to the button itself (same pattern as the account
                  dropdown below) rather than to the header — anchoring to
                  the header positioned it at the viewport's left edge on
                  wide screens instead of near the button. Also the only way
                  to reach Staff directory on desktop, where the pill nav
                  doesn't list it. */}
              {mobileNavOpen && (
                <nav
                  id="mobile-nav-panel"
                  aria-label="Primary"
                  className="glass absolute left-0 top-[calc(100%+0.5rem)] w-56 rounded-2xl p-2 backdrop-blur-xl"
                >
                  <div className="flex flex-col gap-1">
                    {menuNav.map((item) => (
                      <MenuNavLink key={item.href} item={item} active={item.match(pathname)} />
                    ))}
                  </div>
                </nav>
              )}
            </div>
          </div>

          {/* center nav — plain text, dot-separated, desktop only */}
          <nav aria-label="Primary" className="hidden items-center gap-3 lg:flex">
            {nav.map((item, i) => (
              <div key={item.href} className="flex items-center gap-3">
                {i > 0 && <span className="text-ash/40">•</span>}
                <PillLink item={item} active={item.match(pathname)} />
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <span className="hidden rounded-full bg-rail px-3.5 py-1.5 text-sm font-semibold text-rail-ink sm:inline-block">
              {account.name}
            </span>

            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${account.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ash/25 text-sm font-bold text-bone transition hover:border-signal/50"
              >
                {account.name.charAt(0)}
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  className="glass absolute right-0 top-[calc(100%+0.5rem)] w-60 rounded-2xl p-2 backdrop-blur-xl"
                >
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-bone">{account.name}</p>
                    <p className="mt-1 inline-block rounded-full border border-ash/30 px-2 py-0.5 text-label uppercase tracking-[0.12em] text-ash">
                      {account.role}
                    </p>
                  </div>
                  <MenuLink href="/account">Account settings</MenuLink>
                  {/* dev-only; QuickSwitch self-hides via showDevTools() */}
                  <div className="px-3 py-1.5">
                    <QuickSwitch />
                  </div>
                  {showDevTools() && account.role === "admin" && (
                    <button
                      type="button"
                      onClick={resetDemo}
                      title="Undo every change and put the demo back to how it started"
                      className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-ash transition hover:bg-void/40 hover:text-amber"
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
                    className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-ash transition hover:bg-void/40 hover:text-bone"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-12 sm:px-8"
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
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="block rounded-lg px-3 py-1.5 text-sm text-ash transition hover:bg-void/40 hover:text-bone"
    >
      {children}
    </Link>
  );
}

function MenuNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-3 py-1.5 text-sm transition ${
        active ? "bg-void/60 font-semibold text-signal" : "text-ash hover:bg-void/40 hover:text-bone"
      }`}
    >
      {item.label}
    </Link>
  );
}

function PillLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`border-b-2 pb-0.5 text-sm transition ${
        active
          ? "border-signal font-bold text-signal"
          : "border-transparent font-medium text-ash hover:text-bone"
      }`}
    >
      {item.label}
    </Link>
  );
}
