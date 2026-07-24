// Shared wrapper for every Home hub page (landing, announcements, directory,
// resources). Phase 19: Home IS the app's identity now, not a boxed feature
// living inside a different shell — so this no longer wraps content in its
// own bordered card sitting inside AppShell's container (that nesting was
// exactly the "screen inside the website" look that prompted this reskin).
// It just sets the page heading and lets panels sit directly on the shared
// page background.

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
      <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">{intro}</p>}
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
    <section className="glass rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-bone">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HomePillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-signal/40 px-4 py-2 text-sm font-semibold text-signal transition hover:border-signal hover:bg-signal/10"
    >
      {children}
    </Link>
  );
}
