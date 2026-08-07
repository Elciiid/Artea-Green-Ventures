import Image from "next/image";
import Link from "next/link";
import hero from "../../../../public/images/site/whtbl-hero-1155x360_edited.jpg";

// Ported from artea-green-glow's Hero (docs/superpowers/plans/2026-08-07-
// artea-green-glow-reskin.md). "stats" are placeholder figures the
// reference itself hardcodes (no real metrics endpoint exists for this) —
// kept as illustrative copy, same as the reference, not wired to real data.
const stats = [
  { value: "150+", label: "Projects verified" },
  { value: "18", label: "Partner organisations" },
  { value: "42%", label: "Average carbon reduction" },
];

export default function Hero() {
  return (
    <section className="relative isolate min-h-[92vh] overflow-hidden bg-rail text-rail-ink">
      <Image
        src={hero}
        alt="Aerial view of Sydney Harbour Bridge at golden hour"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-b from-rail/85 via-signal-deep/55 to-rail/90" />

      <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-6 pt-40 pb-16 lg:px-10">
        <p className="eyebrow animate-rise text-signal-light">Artea Green Ventures Portal</p>
        <h1 className="animate-rise mt-6 max-w-4xl text-5xl leading-[0.98] font-light sm:text-6xl lg:text-7xl">
          Your team. Your projects.
          <span className="block text-signal-light">Your progress, verified.</span>
        </h1>
        <p className="animate-rise mt-7 max-w-xl text-base font-light leading-relaxed text-rail-ink/80 sm:text-lg">
          One workspace for applications, people and companies across the Artea
          network — with sustainability performance measured, audited and ready to
          report.
        </p>

        <div className="animate-rise mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="#workspace"
            className="rounded-full bg-signal px-7 py-3.5 text-sm font-medium text-void transition-colors hover:bg-signal-light hover:text-rail"
          >
            Explore the portal
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-rail-ink/35 px-7 py-3.5 text-sm font-light text-rail-ink transition-colors hover:border-rail-ink"
          >
            Go to Dashboard
          </Link>
        </div>

        <dl className="mt-20 grid gap-8 border-t border-rail-ink/15 pt-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs font-light tracking-[0.18em] uppercase text-rail-ink/60">
                {stat.label}
              </dt>
              <dd className="mt-2 text-4xl font-light text-rail-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
