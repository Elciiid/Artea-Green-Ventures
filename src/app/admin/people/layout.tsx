import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import PeopleTabNav from "./PeopleTabNav";

export const metadata: Metadata = { title: "People" };

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell expect="admin">
      <div>
        <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
          Admin console
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
          People
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
          Who someone is, what they can see, and what happened — in one place, each with its own page.
        </p>
      </div>

      <PeopleTabNav />

      <div className="mt-8">{children}</div>
    </AppShell>
  );
}
