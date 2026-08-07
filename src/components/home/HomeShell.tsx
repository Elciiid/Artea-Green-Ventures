// Shared page-title block + Panel/PillLink primitives for every Home/
// Dashboard surface. Reskinned to match artea-green-glow's PortalShell/
// Panel (docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md) —
// restyling these two shared primitives in place reskins every dashboard
// that already composes with them, without touching each dashboard file's
// own layout logic.

import Link from "next/link";

export default function HomeShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow text-signal">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-bone sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-ash">{intro}</p>}
      <div className="mt-9">{children}</div>
    </div>
  );
}

export function HomePanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-ash/20 bg-pine p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <h2 className="eyebrow text-ash">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HomePillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-signal hover:underline">
      {children}
    </Link>
  );
}
