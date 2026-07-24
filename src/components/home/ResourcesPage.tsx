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
                className="block rounded-xl border border-ash/15 bg-void/40 px-4 py-3 transition hover:border-signal"
              >
                <span className="font-display text-sm font-bold text-bone">{r.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-ash">
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
