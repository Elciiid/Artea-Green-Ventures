import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import PeopleTabNav from "./PeopleTabNav";

export const metadata: Metadata = { title: "People" };

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell expect="admin" boundedContent>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
            Admin console
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
            People
          </h1>
        </div>

        <div className="shrink-0">
          <PeopleTabNav />
        </div>

        {/* Each tab owns its own fixed-heading/scrollable-content split
            internally (per surface — Access's table and Activity's log
            entries can both grow unbounded; Roles' compact form never
            needs to scroll, so it just renders inline without stretching
            to fill this space). */}
        <div className="mt-8 min-h-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
