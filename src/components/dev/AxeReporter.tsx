"use client";

// Dev-only accessibility scan. Runs axe-core after each route change and
// reports violations to the console, so a11y problems are visible while
// building instead of invisible. The layout only renders this in
// development, and axe is dynamically imported so it never reaches the
// production bundle.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AxeReporter() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    // Wait for entrance animations/hydration to settle before scanning.
    const timer = window.setTimeout(async () => {
      const axe = (await import("axe-core")).default;
      if (cancelled) return;

      const results = await axe.run(document, { resultTypes: ["violations"] });
      if (cancelled) return;

      if (results.violations.length === 0) {
        console.info(`[axe] ${pathname}: no accessibility violations`);
        return;
      }

      console.warn(
        `[axe] ${pathname}: ${results.violations.length} accessibility violation(s)`
      );
      for (const v of results.violations) {
        console.warn(
          `[axe] ${v.impact ?? "unknown"} · ${v.id} — ${v.help}`,
          v.nodes.map((n) => n.target).flat()
        );
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
