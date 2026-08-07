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
import { LayoutDashboard, FileText, Users, Building2, UsersRound, type LucideIcon } from "lucide-react";
import { roleHome, showDevTools, useSession, type Role } from "@/lib/session";
import { useApplications } from "@/lib/applications";
import { Wordmark } from "@/components/Logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

// Shown for every role. Distinct from Home (/home — the logo's destination
// and post-login default, roleHome() in src/lib/session.ts): this is the
// per-role Dashboard content, not the landing page. Matches the reference
// repo's own route split (index.tsx marketing page vs. dashboard.tsx) —
// see docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md.
const HOME_ITEM: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  match: (p) => p === "/dashboard" || p.startsWith("/dashboard/"),
};

export default function AppShell({
  expect,
  requireCompanyManager = false,
  boundedContent = false,
  fullBleed = false,
  heroHeader = false,
  hideFooter = false,
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
  /** Drops <main>'s max-w-6xl/px-5/py-12 constraint entirely — for Home's
   * landing page (artea-green-glow reskin), whose Hero needs a genuine
   * full-viewport-width image, not just padding cancelled via a negative
   * margin (which still can't escape the parent's max-width). The caller
   * becomes responsible for every section's own container/padding, same as
   * the reference's index.tsx not using its shared PortalShell at all. */
  fullBleed?: boolean;
  /** Floats the header transparently over the page's own content instead of
   * the normal sticky opaque bar — matches the reference's SiteHeader,
   * which is `absolute`, not `sticky`, and genuinely scrolls out of view
   * past the hero (no persistent nav below it, same as the reference).
   * Home (/home) is the only page that uses this: it's the one surface this
   * reskin treats as the reference's public marketing page, not another
   * operational surface — every other page keeps the normal persistent nav.
   * Requires fullBleed (a light-on-dark header only makes sense sitting
   * directly on a full-bleed hero image, not a padded content column). */
  heroHeader?: boolean;
  /** Skips AppShell's own simple footer — Home supplies the reference's
   * richer three-column SiteFooter itself (see HomeLanding.tsx), which
   * doesn't fit the plain one-liner every other page uses. */
  hideFooter?: boolean;
  children: React.ReactNode;
}) {
  const account = useSession((s) => s.account);
  const hydrated = useSession((s) => s.hydrated);
  const signOut = useSession((s) => s.signOut);
  const resetDemo = useApplications((s) => s.resetDemo);
  const router = useRouter();
  const pathname = usePathname();
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

  // Close the account menu whenever the route changes. The dock (below)
  // needs no such reset — it's a plain link row, never an open/close menu.
  useEffect(() => {
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
      <header
        className={
          heroHeader
            ? "absolute inset-x-0 top-0 z-30 shrink-0"
            : "sticky top-0 z-40 shrink-0 border-b border-ash/15 bg-void/60 shadow-panel backdrop-blur-xl"
        }
      >
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
        <div
          className={`mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 sm:px-6 ${heroHeader ? "lg:px-10" : ""}`}
        >
          <div className="col-start-1 flex items-center gap-3">
            <Link href={roleHome(account.role)} className="flex shrink-0 items-center gap-3">
              <Wordmark variant={heroHeader ? "white" : "green"} />
              {!heroHeader && (
                <>
                  <span aria-hidden className="hidden h-5 w-px bg-ash/25 sm:block" />
                  <span className="hidden text-xs font-medium uppercase tracking-[0.2em] text-ash transition-colors hover:text-bone sm:block">
                    Home
                  </span>
                </>
              )}
            </Link>
          </div>

          {/* center nav — plain text links, desktop only */}
          <nav aria-label="Primary" className="col-start-2 hidden items-center gap-7 lg:flex">
            {nav.map((item) => (
              <PillLink key={item.href} item={item} active={item.match(pathname)} light={heroHeader} />
            ))}
          </nav>

          <div className="col-start-3 flex items-center justify-end gap-2.5">
            {!heroHeader && (
              <span className="hidden rounded-full bg-rail px-3.5 py-1.5 text-sm font-semibold text-rail-ink sm:inline-block">
                {account.name}
              </span>
            )}

            <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
              <DropdownMenuTrigger asChild>
                {heroHeader ? (
                  <button
                    type="button"
                    aria-label={`Account menu for ${account.name}`}
                    className="rounded-full border border-rail-ink/35 px-5 py-2 text-sm font-light text-rail-ink backdrop-blur-sm transition-colors hover:bg-rail-ink hover:text-rail"
                  >
                    {account.name}
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Account menu for ${account.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ash/25 text-sm font-bold text-bone transition hover:border-signal/50"
                  >
                    {account.name.charAt(0)}
                  </button>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass w-60">
                <DropdownMenuLabel className="px-3 py-2 font-normal">
                  <p className="flex items-center gap-2 text-sm font-medium text-bone">
                    {account.name}
                    <span className="rounded-full border border-ash/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ash">
                      {account.role}
                    </span>
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

      <Dock nav={nav} pathname={pathname} light={heroHeader} />

      <main
        id="main-content"
        className={
          fullBleed
            ? "relative z-10 flex w-full flex-1 flex-col"
            : `relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pt-12 sm:px-8 ${
                boundedContent ? "pb-6" : "pb-12"
              } ${boundedContent ? "min-h-0" : ""}`
        }
      >
        {children}
      </main>

      {!hideFooter && (
        <footer className="relative z-10 shrink-0 border-t border-ash/15">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <div className="flex flex-col gap-2 text-xs font-light text-ash sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-bone">Artea Green Ventures</p>
                <p>Environmental compliance · Australia &amp; the Philippines</p>
              </div>
              <div className="sm:text-right">
                {/* gated on showDevTools() for consistency with the login
                    "Demo build" chip — the "illustrative, not official" notice
                    must not linger over real records in production */}
                {showDevTools() && (
                  <p>Demo environment · records shown are illustrative, not official.</p>
                )}
                <p>© 2026 Artea Green Ventures</p>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

// One icon per nav label — small, closed set (Dashboard/Applications/
// People/Companies/My Team), a lookup is simpler than threading an icon
// through NavItem/recordsNav() for every call site.
const DOCK_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Applications: FileText,
  People: Users,
  Companies: Building2,
  "My Team": UsersRound,
};

/** Replaces the hamburger + slide-out Sheet below `lg`: a fixed, floating
 * icon dock, matching a reference the user provided directly (a macOS-
 * style dock with hover tooltips), not the artea-green-glow repo itself —
 * that reference has no documented mobile nav pattern at all. Each icon's
 * label shows in a Tooltip on hover; the icon + aria-label alone (not
 * hover text, which touch has no equivalent for) is what actually carries
 * meaning on a phone. */
function Dock({
  nav,
  pathname,
  light,
}: {
  nav: NavItem[];
  pathname: string;
  light: boolean;
}) {
  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-1 rounded-full border px-2 py-2 shadow-pop backdrop-blur-sm lg:hidden ${
        light ? "border-rail-ink/20 bg-rail/90" : "border-rail-ink/10 bg-rail/95"
      }`}
    >
      {nav.map((item) => {
        const active = item.match(pathname);
        const Icon = DOCK_ICONS[item.label] ?? LayoutDashboard;
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  active ? "bg-signal text-void" : "text-rail-ink/80 hover:bg-rail-ink/10 hover:text-rail-ink"
                }`}
              >
                <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function PillLink({
  item,
  active,
  light = false,
}: {
  item: NavItem;
  active: boolean;
  /** For heroHeader mode — light text over a dark hero image instead of
   * dark text over the normal light header. */
  light?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`text-sm transition-colors ${
        light
          ? active
            ? "font-medium text-rail-ink"
            : "font-light text-rail-ink/85 hover:text-rail-ink"
          : active
            ? "font-medium text-signal"
            : "font-light text-ash hover:text-bone"
      }`}
    >
      {item.label}
    </Link>
  );
}
