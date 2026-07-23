"use client";

// Mirrors the stored display preferences onto <html> as data attributes, so
// CSS can act on them. `data-motion` carries the *resolved* value (OS setting
// combined with any manual override), which is what the stylesheet keys off.

import { useEffect } from "react";
import {
  usePreferences,
  useReducedMotionPref,
  useResolvedTheme,
} from "@/lib/preferences";

export default function PreferencesEffect() {
  const textSize = usePreferences((s) => s.textSize);
  const reduced = useReducedMotionPref();
  const theme = useResolvedTheme();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (textSize === "default") delete root.dataset.textSize;
    else root.dataset.textSize = textSize;
  }, [textSize]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);

  return null;
}
