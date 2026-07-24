import Image from "next/image";
import logo from "../../public/images/Artea Logo Assets-09.avif";

// Real brand asset: a white knockout lockup on a genuinely transparent
// background (266×85 AVIF, verified by pixel-sampling) — the black PNG
// variant is opaque-white-backed instead, so this one is the better fit
// now that everything's on a light surface: invert(1) flips the white
// linework to black while leaving the alpha channel (and so the
// transparency) untouched, and unlike mix-blend-multiply it isn't
// dependent on the backdrop being exactly white.

export function Wordmark({ hideTagOnMobile = false }: { hideTagOnMobile?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      {/* explicit dimensions: Turbopack can't probe AVIF, so the static
          import carries placeholder 100×100 attrs — these override them
          with the real 266×85 so pre-load layout keeps the true ratio */}
      <Image
        src={logo}
        alt="Artea Green Ventures"
        width={266}
        height={85}
        priority
        className="h-6 w-auto invert sm:h-7"
      />
      <span className={`items-center gap-3 ${hideTagOnMobile ? "hidden sm:flex" : "flex"}`}>
        <span aria-hidden className="h-5 w-px bg-ash/25" />
        <span className="font-display text-label font-extrabold uppercase tracking-[0.08em] text-bone">
          Home
        </span>
      </span>
    </span>
  );
}
