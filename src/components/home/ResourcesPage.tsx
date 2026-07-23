// Static resources list — no data fetching, so no client component needed.
// See src/lib/resources.ts for why this is a hardcoded list rather than a
// table.

import { RESOURCES } from "@/lib/resources";
import HomeShell, { HomePanel } from "@/components/home/HomeShell";

export default function ResourcesPage() {
  return (
    <HomeShell eyebrow="AGV Home" title="Resources">
      <HomePanel title="Handbooks, templates & support">
        <ul className="grid gap-3 sm:grid-cols-2">
          {RESOURCES.map((r) => (
            <li key={r.title}>
              <a
                href={r.href}
                className="block rounded-xl border border-home-border bg-home-cream px-4 py-3 transition hover:border-home-sage"
              >
                <span className="font-display text-sm font-bold text-home-ink">{r.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-home-muted">
                  {r.description}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </HomePanel>
    </HomeShell>
  );
}
