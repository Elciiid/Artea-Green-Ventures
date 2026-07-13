"use client";

// Counts up from 0 on mount. Renders 0 on the server and first client
// frame (hydration-safe), then animates — or snaps straight to the value
// under prefers-reduced-motion.
//
// If the tab is hidden when it mounts (background tab, headless capture),
// rAF is paused and an animation would sit at 0 indefinitely — so show the
// real value immediately and play the count-up when the page first becomes
// visible instead.

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function KineticNumber({
  value,
  delay = 0,
  className,
}: {
  value: number;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    let controls: ReturnType<typeof animate> | undefined;
    const play = () => {
      controls = animate(0, value, {
        duration: 1.1,
        delay,
        ease: EASE,
        onUpdate: (v) => setDisplay(Math.round(v)),
      });
    };

    if (document.visibilityState === "hidden") {
      setDisplay(value);
      const onVisible = () => {
        if (document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", onVisible);
          play();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        document.removeEventListener("visibilitychange", onVisible);
        controls?.stop();
      };
    }

    play();
    return () => controls?.stop();
  }, [value, delay, reduced]);

  return <span className={className}>{display}</span>;
}
