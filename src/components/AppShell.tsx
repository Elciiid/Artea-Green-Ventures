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
import { useEffect, useMemo, useState } from "react";
import { roleHome, showDevTools, useSession, type Role } from "@/lib/session";
import { useApplications } from "@/lib/applications";
import { Wordmark } from "@/components/Logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { href: string; label: string; match: (p: string) => boolean };

// Widened to also see isCompanyManager (previously role-only) — the
// Companies nav task flagged this as a likely future need without building
// it prematurely; My Team is that need. Meaningless for role === "admin",
// passed through unconditionally since only the client branch checks it.
function recordsNav(role: Role, isCompanyManager: boolean): NavItem[] {
  return role === "admin"
    ? [
        {
          href: "/admin",
          label: "Applications",
          match: (p) => p === "/admin" || p.startsWith("/admin/applications"),
        },
        {
          href: "/admin/people",
          label: "People",
          match: (p) => p.startsWith("/admin/people"),
        },
        {
          href: "/admin/companies",
          label: "Companies",
          match: (p) => p.startsWith("/admin/companies"),
        },
      ]
    : [
        {
          href: "/portal",
          label: "Applications",
          match: (p) => p === "/portal" || p.startsWith("/portal/applications"),
        },
        // isCompanyManager alone, no explicit role check — company
        // assignment is intended to be client-only, but nothing at the
        // schema layer enforces that (company_id/is_company_manager are
        // independent of role; see the defense-in-depth role filters added
        // in 20260805160000/20260805170000, which exist precisely because a
        // staff account CAN have is_company_manager set via a
        // misconfigured /api/admin/set-company call). A misconfigured staff
        // account would see this pill, but /portal/team's own
        // requireCompanyManager + role gating still redirects them away —
        // this pill showing is cosmetic, not an access-control gap.
        ...(isCompanyManager
          ? [
              {
                href: "/portal/team",
                label: "My Team",
                match: (p: string) => p.startsWith("/portal/team"),
              },
            ]
          : []),
      ];
}

// Shown for every role — the earlier "client gets no Home hub at all"
// decision (Phase 18) has been deliberately reversed; every role now lands
// on /home (see roleHome() in src/lib/session.ts) and gets this nav item.
const HOME_ITEM: NavItem = {
  href: "/home",
  label: "Dashboard",
  match: (p) => p === "/home" || p.startsWith("/home/"),
};

export default function AppShell({
  expect,
  requireCompanyManager = false,
  boundedContent = false,
  children,
}: {
  expect?: Role | Role[];
  /** Narrower than `expect`: gates on account.isCompanyManager in addition
   * to (not instead of) any role check above. `expect` only takes
   * `Role`/`Role[]`, and widening it to understand flags would be a larger
   * refactor than this one flag-gated page warrants — so this is a separate,
   * additive prop rather than a change to `expect`'s own shape. A regular
   * client (isCompanyManager: false) hitting a page gated this way is
   * redirected away exactly like a role mismatch. */
  requireCompanyManager?: boolean;
  /** Locks the shell to exactly the viewport height instead of a min-height
   * that grows with content — header/nav and footer stay pinned, and the
   * page itself never scrolls. Callers that need this (a list that can grow
   * without bound) are responsible for giving their own content region
   * `min-h-0 overflow-y-auto` so THAT region scrolls instead of the page —
   * this prop only sets up the flex constraints that make that possible
   * (no fixed pixel heights anywhere; header/main/footer just share the
   * viewport via ordinary flex distribution). */
  boundedContent?: boolean;
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
  const allowedRoles = useMemo(
    () => (expect === undefined ? null : Array.isArray(expect) ? expect : [expect]),
    [expect]
  );
  const deniedByRole = (acc: NonNullable<typeof account>): boolean =>
    Boolean(allowedRoles && !allowedRoles.includes(acc.role)) ||
    (requireCompanyManager && !acc.isCompanyManager);

  useEffect(() => {
    if (!hydrated) return;
    if (!account) {
      router.replace("/");
      return;
    }
    if (deniedByRole(account)) router.replace(roleHome(account.role));
    // deniedByRole is a plain function recomputed every render (reads
    // allowedRoles/requireCompanyManager, both already deps below via their
    // own stable inputs), not a stable dependency itself — see
    // allowedRoles's own useMemo above for why the role half of this needs
    // one at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, account, allowedRoles, requireCompanyManager, router]);

  // Close both menus whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  // Shown while the persisted session restores or a redirect is pending.
  if (!hydrated || !account || deniedByRole(account)) {
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

  const nav = [HOME_ITEM, ...recordsNav(account.role, account.isCompanyManager)];
  const menuNav = nav;

  return (
    // min-h-full, not min-h-dvh: dvh is an absolute viewport unit, so it
    // ignores how much height this div's flex parent actually allocated to
    // it (that parent's own height is already viewport-minus-DemoBanner) —
    // on any short-content page this silently overflowed the parent by
    // exactly DemoBanner's height, forcing a permanent ~15px scrollbar
    // that isn't there on pages using boundedContent (which already uses
    // h-full for the same reason). min-h-full correctly floors at "whatever
    // height the parent actually gave me" while still letting real content
    // grow taller than that when it needs to.
    <div
      className={`relative flex flex-col ${boundedContent ? "h-full overflow-hidden" : "min-h-full"}`}
    >
      <header className="sticky top-0 z-40 shrink-0">
        {/* A plain 3-child justify-between flex only looks centered when the
            two flanking groups happen to be equal width — they aren't here
            (logo+Menu button on the left vs. name badge+avatar on the right,
            both variable width), so the center nav visibly drifted off true
            center as viewport width or account-name length changed. A
            [1fr_auto_1fr] grid centers the middle column independent of the
            flanking content's width. Columns are assigned explicitly
            (col-start-1/2/3) rather than left to auto-placement — below
            `lg` the center nav is `display:none`, which removes it from grid
            auto-placement entirely, so without an explicit column the right
            block would slide into column 2 instead of staying in column 3.
            Verified via computed grid-template-columns + child rects at
            768/1024/1440px. */}
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-5 sm:px-6">
          <div className="col-start-1 flex items-center gap-3">
            <Link href={roleHome(account.role)} className="flex shrink-0 items-center">
              <Wordmark hideTagOnMobile />
            </Link>

            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Toggle navigation menu"
                  className="ml-1 inline-flex items-center gap-2 rounded-full border border-ash/25 px-3.5 py-1.5 text-sm text-ash transition hover:border-signal/50 hover:text-bone lg:hidden"
                >
                  <svg aria-hidden width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M2 4.5h14M2 9h14M2 13.5h14" />
                  </svg>
                  Menu
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="glass data-[side=left]:w-72 backdrop-blur-xl">
                <SheetHeader>
                  <SheetTitle className="font-display text-bone">Navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Jump to any section of AGV Home.
                  </SheetDescription>
                </SheetHeader>
                <nav aria-label="Primary" className="flex flex-col gap-1 px-4 pb-4">
                  {menuNav.map((item) => (
                    <MenuNavLink key={item.href} item={item} active={item.match(pathname)} />
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* center nav — plain text, dot-separated, desktop only */}
          <nav aria-label="Primary" className="col-start-2 hidden items-center gap-3 lg:flex">
            {nav.map((item, i) => (
              <div key={item.href} className="flex items-center gap-3">
                {i > 0 && <span className="text-ash/40">•</span>}
                <PillLink item={item} active={item.match(pathname)} />
              </div>
            ))}
          </nav>

          <div className="col-start-3 flex items-center justify-end gap-2.5">
            <span className="hidden rounded-full bg-rail px-3.5 py-1.5 text-sm font-semibold text-rail-ink sm:inline-block">
              {account.name}
            </span>

            <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Account menu for ${account.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-ash/25 text-sm font-bold text-bone transition hover:border-signal/50"
                >
                  {account.name.charAt(0)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass w-60 backdrop-blur-xl">
                <DropdownMenuLabel className="px-3 py-2 font-normal">
                  <p className="text-sm font-medium text-bone">{account.name}</p>
                  <p className="mt-1 inline-block rounded-full border border-ash/30 px-2 py-0.5 text-label uppercase tracking-[0.12em] text-ash">
                    {account.role}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">Account settings</Link>
                </DropdownMenuItem>
                {showDevTools() && account.role === "admin" && (
                  <DropdownMenuItem
                    onSelect={() => resetDemo()}
                    title="Undo every change and put the demo back to how it started"
                    className="text-ash focus:text-amber"
                  >
                    Reset demo data
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={async () => {
                    await signOut();
                    router.push("/");
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 sm:px-8 ${
          boundedContent ? "py-6" : "py-12"
        } ${boundedContent ? "min-h-0" : ""}`}
      >
        {children}
      </main>

      <footer className="relative z-10 shrink-0 border-t border-ash/15">
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

function MenuNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
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
