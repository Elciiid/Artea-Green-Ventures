"use client";

// AGV Home landing — Phase 19 hero, rebuilt to match a supplied reference
// composition structurally (an EV-charger product page), recolored from the
// reference's lime accent to sage/forest green, content rewritten for
// AGV Home (not a reskin of the reference's charger copy).
//
// The bottom tile row (Announcements/Staff directory/Resources) was removed
// entirely per an explicit decision to drop those three features — see
// STATUS.md. Home is now just the hero; deliberately left that way rather
// than inventing a replacement silently (flagged in the report, not decided
// here).

import Image from "next/image";
import Link from "next/link";
import { useSession } from "@/lib/session";

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

  return (
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
          Track environmental approvals from first submission to final
          report, all in one place.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={account?.role === "admin" ? "/admin" : "/portal"}
            className="inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 text-sm font-semibold text-void transition hover:brightness-110"
          >
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />
            </svg>
            Browse applications
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
  );
}
