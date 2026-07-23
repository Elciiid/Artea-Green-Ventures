"use client";

// AGV Home landing — the new post-login default for admin/staff. Photography
// placeholder: no generic Home-hub photography exists in the repo yet (only
// tracker-specific application hero shots), so the hero uses a tasteful warm
// gradient instead of a fabricated stock photo — real photography is a
// flagged follow-up, not something this phase invents.

import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { fetchAnnouncements, type Announcement } from "@/lib/supabase/home";
import HomeShell, { HomePanel, HomePillLink } from "@/components/home/HomeShell";
import { formatDate } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; announcements: Announcement[] };

export default function HomeLanding() {
  const account = useSession((s) => s.account);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchAnnouncements(3)
      .then((announcements) => {
        if (!cancelled) setState({ status: "ready", announcements });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "Something went wrong loading announcements.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HomeShell
      eyebrow="AGV Home"
      title={`Welcome back${account ? `, ${account.name}` : ""}.`}
      intro="Your internal hub for what's happening across Artea Green Ventures — announcements, the staff directory, and shared resources."
    >
      {/* hero placeholder — warm gradient standing in for photography */}
      <div
        aria-hidden
        className="mb-8 h-40 rounded-2xl bg-gradient-to-br from-home-sage/20 via-home-cream to-home-sage/30 sm:h-52"
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <HomePanel title="Latest announcements" action={<HomePillLink href="/home/announcements">View all</HomePillLink>}>
          {state.status === "loading" ? (
            <p className="text-sm text-home-muted">Loading…</p>
          ) : state.status === "error" ? (
            <p className="text-sm text-home-muted">{state.message}</p>
          ) : state.announcements.length === 0 ? (
            <p className="text-sm text-home-muted">No announcements yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {state.announcements.map((a) => (
                <li key={a.id} className="border-b border-home-border pb-4 last:border-b-0 last:pb-0">
                  <p className="font-display text-sm font-bold text-home-ink">{a.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-home-muted">{a.body}</p>
                  <p className="mt-2 text-label uppercase tracking-[0.1em] text-home-muted">
                    {a.createdByName} · {formatDate(a.createdAt.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </HomePanel>

        <div className="flex flex-col gap-6">
          <HomePanel title="Staff directory">
            <p className="text-sm leading-relaxed text-home-muted">
              Find who&apos;s who across admin and staff.
            </p>
            <div className="mt-4">
              <HomePillLink href="/home/directory">Open directory</HomePillLink>
            </div>
          </HomePanel>
          <HomePanel title="Resources">
            <p className="text-sm leading-relaxed text-home-muted">
              Handbooks, templates, and support links.
            </p>
            <div className="mt-4">
              <HomePillLink href="/home/resources">Browse resources</HomePillLink>
            </div>
          </HomePanel>
        </div>
      </div>
    </HomeShell>
  );
}
