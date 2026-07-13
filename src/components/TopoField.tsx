"use client";

// Signature motif: glowing topographic contour lines.
// - Rings nest like level curves of real landforms (shared noise profile).
// - One "index contour" is painted Signal, the way survey maps emphasise
//   every Nth line.
// - Optional plotter-style draw-in and pointer parallax, both disabled
//   under prefers-reduced-motion.

import { useEffect, useId, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { contourPaths, type Peak } from "@/lib/topo";

const DEFAULT_PEAKS: Peak[] = [
  { cx: 260, cy: 660, r0: 56, rings: 7, gap: 38 },
  { cx: 1160, cy: 170, r0: 44, rings: 6, gap: 34 },
  { cx: 900, cy: 800, r0: 30, rings: 4, gap: 30 },
];

type Props = {
  className?: string;
  peaks?: Peak[];
  seed?: number;
  /** shift the field with the pointer (hero use) */
  parallax?: boolean;
  /** animate lines drawing in on mount */
  draw?: boolean;
};

function ringOpacity(i: number, total: number) {
  // innermost contour brightest, fading outward
  return 0.1 + ((total - 1 - i) / Math.max(total - 1, 1)) * 0.24;
}

export default function TopoField({
  className = "",
  peaks = DEFAULT_PEAKS,
  seed = 7,
  parallax = false,
  draw = false,
}: Props) {
  const reduced = useReducedMotion();
  const rawId = useId();
  const glowId = `glow-${rawId.replace(/[^a-zA-Z0-9-]/g, "")}`;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 38, damping: 18 });
  const sy = useSpring(my, { stiffness: 38, damping: 18 });

  useEffect(() => {
    if (!parallax || reduced) return;
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 26);
      my.set((e.clientY / window.innerHeight - 0.5) * 18);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [parallax, reduced, mx, my]);

  const layers = useMemo(
    () =>
      peaks.map((p, i) => ({
        key: i,
        paths: contourPaths(p, seed + i * 101),
      })),
    [peaks, seed]
  );

  const animateDraw = draw && !reduced;

  return (
    <motion.div
      aria-hidden
      style={parallax && !reduced ? { x: sx, y: sy, scale: 1.04 } : undefined}
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {layers.map(({ paths, key }) => (
          <g key={key}>
            {/* soft glow pass under the crisp lines */}
            <g filter={`url(#${glowId})`} opacity={0.55}>
              {paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  stroke="var(--color-contour)"
                  strokeWidth={1.8}
                  opacity={ringOpacity(i, paths.length)}
                />
              ))}
            </g>
            <g>
              {paths.map((d, i) => {
                const isIndex = key === 0 && i === Math.max(paths.length - 2, 0);
                const stroke = isIndex
                  ? "var(--color-signal)"
                  : "var(--color-contour)";
                const opacity =
                  ringOpacity(i, paths.length) * (isIndex ? 1.9 : 1);
                return animateDraw ? (
                  <motion.path
                    key={i}
                    d={d}
                    stroke={stroke}
                    strokeWidth={isIndex ? 1.4 : 1}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity }}
                    transition={{
                      duration: 1.6,
                      delay: 0.2 + i * 0.09 + key * 0.25,
                      ease: "easeOut",
                    }}
                  />
                ) : (
                  <path
                    key={i}
                    d={d}
                    stroke={stroke}
                    strokeWidth={isIndex ? 1.4 : 1}
                    opacity={opacity}
                  />
                );
              })}
            </g>
          </g>
        ))}
      </svg>
    </motion.div>
  );
}
