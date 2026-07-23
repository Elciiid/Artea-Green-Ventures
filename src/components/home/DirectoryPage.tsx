"use client";

// Staff directory — surfaces agv_profiles name/role for admin + staff only.
// The RLS grant behind fetchDirectory() makes every profile row readable to
// staff (there's no row-level way to say "only admin/staff rows"), so the
// role filter lives in the query itself; see fetchDirectory's doc comment.

import { useEffect, useState } from "react";
import { fetchDirectory, type DirectoryEntry } from "@/lib/supabase/home";
import HomeShell, { HomePanel } from "@/components/home/HomeShell";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: DirectoryEntry[] };

export default function DirectoryPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchDirectory()
      .then((entries) => {
        if (!cancelled) setState({ status: "ready", entries });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "Something went wrong loading the directory.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HomeShell eyebrow="AGV Home" title="Staff directory">
      <HomePanel title="Admin & staff">
        {state.status === "loading" ? (
          <p className="text-sm text-home-muted">Loading…</p>
        ) : state.status === "error" ? (
          <p className="text-sm text-home-muted">{state.message}</p>
        ) : state.entries.length === 0 ? (
          <p className="text-sm text-home-muted">No one to show yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-home-border bg-home-cream px-4 py-3"
              >
                <span className="font-display text-sm font-bold text-home-ink">{entry.name}</span>
                <span className="rounded-full border border-home-sage/40 px-2.5 py-0.5 text-label uppercase tracking-[0.14em] text-home-sage">
                  {entry.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </HomePanel>
    </HomeShell>
  );
}
