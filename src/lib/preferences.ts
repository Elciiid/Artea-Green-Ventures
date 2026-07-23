// Display preferences — text size and motion.
//
// Client-side only, persisted per browser (not per account), because no
// backend exists yet. Once Phase 10a/10c land, these belong on the
// `profiles` table so they follow a person across devices.

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useReducedMotion } from "framer-motion";

/**
 * There is deliberately no step below "default": the default already sits on
 * the type-size floor (--text-label, 0.75rem), so a smaller step would break
 * the minimum this phase established.
 */
export type TextSize = "default" | "large" | "larger";

/** "system" follows the OS setting; the others override it either way. */
export type MotionPref = "system" | "reduced" | "full";

/** Same override pattern as motion: manual choice wins, OS is the default. */
export type ThemePref = "system" | "dark" | "light";

/** The theme actually in effect once the preference is resolved. */
export type ResolvedTheme = "dark" | "light";

export const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "larger", label: "Larger" },
];

export const MOTION_PREFS: { value: MotionPref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "reduced", label: "Reduced" },
  { value: "full", label: "Full" },
];

type PreferencesState = {
  textSize: TextSize;
  motion: MotionPref;
  theme: ThemePref;
  hydrated: boolean;
  setTextSize: (t: TextSize) => void;
  setMotion: (m: MotionPref) => void;
  setTheme: (t: ThemePref) => void;
  _setHydrated: (v: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      textSize: "default",
      motion: "system",
      // Institutional register (Phase 16): the app leads in the restrained
      // light "field notebook" mode. Dark stays available via the toggle.
      theme: "light",
      hydrated: false,
      setTextSize: (textSize) => set({ textSize }),
      setMotion: (motion) => set({ motion }),
      setTheme: (theme) => set({ theme }),
      _setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "agv-demo-preferences",
      partialize: (s) => ({
        textSize: s.textSize,
        motion: s.motion,
        theme: s.theme,
      }),
      onRehydrateStorage: () => (state) => state?._setHydrated(true),
    }
  )
);

/**
 * The theme in effect: manual choice wins, `prefers-color-scheme` is the
 * fallback when set to System.
 *
 * Only call this from components that render nothing (PreferencesEffect) or
 * from event handlers — the server can't know the client's theme, so using it
 * to branch markup would cause a hydration mismatch. Everything visual themes
 * itself through CSS off the `data-theme` attribute instead.
 */
export function useResolvedTheme(): ResolvedTheme {
  const pref = usePreferences((s) => s.theme);
  const [systemLight, setSystemLight] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setSystemLight(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemLight ? "light" : "dark";
}

/**
 * Whether motion should be reduced right now: the manual override wins, and
 * the OS setting is the fallback when no override is set.
 *
 * Use this instead of framer-motion's `useReducedMotion` directly, so the
 * in-app toggle is honoured as well as the OS preference.
 */
export function useReducedMotionPref(): boolean {
  const pref = usePreferences((s) => s.motion);
  const systemReduced = useReducedMotion();
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return !!systemReduced;
}
