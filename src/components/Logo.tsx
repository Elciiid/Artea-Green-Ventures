import { contourPaths } from "@/lib/topo";

// The mark is three nested contour rings — the motif at monogram scale.
// Generated once at module load with a fixed seed, so it's stable.
const RINGS = contourPaths({ cx: 32, cy: 34, r0: 8, rings: 3, gap: 9, amp: 0.18 }, 11);

export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      {RINGS.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="var(--color-signal)"
          strokeWidth={3.4 - i * 0.7}
          opacity={1 - i * 0.3}
        />
      ))}
    </svg>
  );
}

export function Wordmark({ hideTextOnMobile = false }: { hideTextOnMobile?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark className="h-7 w-7" />
      <span className={`leading-none ${hideTextOnMobile ? "hidden sm:block" : ""}`}>
        <span className="block font-mono text-[9px] uppercase tracking-[0.28em] text-ash">
          Artea Green Ventures
        </span>
        <span className="mt-1 block font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-bone">
          Field Portal
        </span>
      </span>
    </span>
  );
}
