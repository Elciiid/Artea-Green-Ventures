// Deterministic topographic contour generator.
// Seeded PRNG keeps server and client output identical, so SVG markup
// never drifts between SSR and hydration.

export type Peak = {
  cx: number;
  cy: number;
  /** innermost ring radius */
  r0: number;
  /** number of contour rings */
  rings: number;
  /** distance between rings */
  gap: number;
  /** radial noise amplitude, as a fraction of radius */
  amp?: number;
};

type Pt = [number, number];

const TAU = Math.PI * 2;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Closed Catmull-Rom spline through the points, emitted as cubic beziers. */
function smoothClosedPath(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + " Z";
}

/**
 * Contour rings for one landform. Every ring shares the same angular noise
 * profile so the rings nest like level curves of a single peak instead of
 * random blobs.
 */
export function contourPaths(peak: Peak, seed: number): string[] {
  const rand = mulberry32(seed);
  const amp = peak.amp ?? 0.16;
  const harmonics = [1, 2, 3, 5].map((k) => ({
    k,
    a: (rand() * amp * 2) / k,
    phase: rand() * TAU,
  }));

  const paths: string[] = [];
  const steps = 44;
  for (let ring = 0; ring < peak.rings; ring++) {
    const base = peak.r0 + ring * peak.gap;
    const drift = 1 + ring * 0.05; // outer contours wander a little more
    const pts: Pt[] = [];
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * TAU;
      let m = 1;
      for (const h of harmonics) m += h.a * drift * Math.sin(h.k * a + h.phase);
      // slight vertical squash reads as terrain seen at an angle
      pts.push([peak.cx + base * m * Math.cos(a), peak.cy + base * m * Math.sin(a) * 0.82]);
    }
    paths.push(smoothClosedPath(pts));
  }
  return paths;
}
