"use client";

// AGV Home landing — Phase 19, rebuilt to match a supplied reference
// composition structurally (an EV-charger product page), recolored from the
// reference's lime accent to sage/forest green, content rewritten for
// AGV Home (not a reskin of the reference's charger copy). Hero photo is the
// Gemini-generated abstract render at public/images/site/home-hero.jpg.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { fetchAnnouncements, type Announcement } from "@/lib/supabase/home";
import { formatDate } from "@/lib/format";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; announcements: Announcement[] };

const TILES: {
  href: string;
  label: string;
  description: string;
  action: string;
  icon: React.ReactNode;
}[] = [
  {
    href: "/home/announcements",
    label: "Announcements",
    description: "What's new across the team.",
    action: "View",
    icon: <path d="M4 10v4l3 1v4l4-2h5a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9L4 6Z" />,
  },
  {
    href: "/home/directory",
    label: "Staff directory",
    description: "Find who's who across admin and staff.",
    action: "Open",
    icon: (
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 20c0-3 2.7-5 6-5s6 2 6 5M15 20c0-2.2-1-4-3-4.8 1-.6 3-.6 4 0 2 .9 3 2.7 3 4.8" />
    ),
  },
  {
    href: "/home/resources",
    label: "Resources",
    description: "Handbooks, templates, and support links.",
    action: "Browse",
    icon: <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v5h5M8 13h8M8 17h5" />,
  },
];

// small info glyphs for the spec row — thematic (compliance/environment/
// people/regions), not literal EV icons.
const SPEC_ICONS: React.ReactNode[] = [
  <path key="leaf" d="M6 20c8 0 12-4 12-12 0-2 0-4-1-6-6 0-11 3-11 9 0 3 1 6 3 8Z" />,
  <path key="shield" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Zm-1.5 9.5 4-4M9 12.5l1.5 1.5" />,
  <path key="people" d="M8 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19c0-2.5 2.2-4 5-4s5 1.5 5 4M11 19c0-2.5 2.2-4 5-4s5 1.5 5 4" />,
  <path key="globe" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.2 2.4 3.4 5.4 3.4 9s-1.2 6.6-3.4 9M12 3c-2.2 2.4-3.4 5.4-3.4 9s1.2 6.6 3.4 9M3.5 9h17M3.5 15h17" />,
];

export default function HomeLanding() {
  const account = useSession((s) => s.account);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchAnnouncements(1)
      .then((announcements) => {
        if (!cancelled) setState({ status: "ready", announcements });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = state.status === "ready" ? state.announcements[0] : undefined;

  const announcementDescription =
    state.status === "loading"
      ? "Loading the latest update…"
      : latest
        ? `${latest.title} · ${formatDate(latest.createdAt.slice(0, 10))}`
        : "No announcements yet.";

  const tiles = TILES.map((tile) =>
    tile.href === "/home/announcements"
      ? { ...tile, description: announcementDescription }
      : tile,
  );

  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        {/* ——— left: eyebrow, headline, copy, CTAs, spec row ——— */}
        <div>
          <p className="flex items-center gap-1.5 text-label font-semibold uppercase tracking-[0.18em] text-signal">
            Care for people, projects &amp; place
            <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </p>

          <h1 className="mt-4 flex items-start gap-3 font-display text-4xl font-bold leading-[1.05] text-bone sm:text-5xl">
            <svg aria-hidden width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-2 shrink-0 text-ash">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
            <span>
              Your team.
              <br />
              Your <span className="text-signal">progress.</span>
            </span>
          </h1>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-ash sm:text-base">
            Announcements, the people you work with, and the resources you
            need — all in one place, always up to date.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/home/announcements"
              className="inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 text-sm font-semibold text-void transition hover:brightness-110"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />
              </svg>
              View announcements
            </Link>
            <Link
              href={account?.role === "admin" ? "/admin" : "/portal"}
              className="rounded-full border border-ash/25 px-6 py-3 text-sm font-semibold text-bone transition hover:border-signal/50 hover:text-signal"
            >
              Browse applications →
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-label uppercase tracking-[0.14em] text-ash">
            <span>Artea Green Ventures</span>
            <span className="h-3 w-px bg-ash/25" />
            <span>AU + PH</span>
            <span className="h-3 w-px bg-ash/25" />
            <span>Est. 2019</span>
          </div>

          <div className="mt-4 flex items-center gap-3 text-ash">
            {SPEC_ICONS.map((icon, i) => (
              <svg key={i} aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                {icon}
              </svg>
            ))}
          </div>
        </div>

        {/* ——— right: hero render, floating directly on the page — no
            panel behind it. home-hero.png is genuinely transparent, so it
            reads as a cutout object rather than a cropped photo. ——— */}
        <div className="relative h-80 sm:h-96">
          <Image
            src="/images/site/home-hero.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-contain"
          />
        </div>
      </div>

      {/* ——— bottom: 3 tiles mapping to Home's real sections ——— */}
      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.href}
            className="glass flex items-center justify-between gap-3 rounded-full py-3 pl-3 pr-4 backdrop-blur-xl"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-signal/15 text-signal">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {tile.icon}
                </svg>
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-bone">{tile.label}</p>
                <p className="truncate text-xs text-ash">{tile.description}</p>
              </div>
            </div>
            <Link
              href={tile.href}
              className="shrink-0 rounded-full bg-signal px-4 py-1.5 text-xs font-semibold text-void transition hover:brightness-110"
            >
              {tile.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
