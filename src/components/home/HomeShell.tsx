// Shared warm-toned wrapper for every Home hub page (landing, announcements,
// directory, resources) — the new visual identity is scoped to this
// component and what's inside it. AppShell's sidebar/header/footer around it
// are untouched and keep the tracker's normal light/dark chrome.

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
    <div className="rounded-3xl border border-home-border bg-home-cream p-6 sm:p-10">
      <p className="text-label font-semibold uppercase tracking-[0.18em] text-home-sage">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-home-ink sm:text-5xl">
        {title}
      </h1>
      {intro && <p className="mt-4 max-w-xl text-sm leading-relaxed text-home-muted">{intro}</p>}
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
    <section className="rounded-2xl border border-home-border bg-home-panel p-6 shadow-[0_18px_44px_-28px_rgba(30,42,31,0.25)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-home-ink">{title}</h2>
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
      className="inline-flex items-center gap-2 rounded-full border border-home-sage/40 px-4 py-2 text-sm font-semibold text-home-sage transition hover:border-home-sage hover:bg-home-sage/10"
    >
      {children}
    </Link>
  );
}
