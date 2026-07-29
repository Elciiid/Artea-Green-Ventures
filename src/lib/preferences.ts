// Motion preference. Phase 19 removed the user-facing display-settings
// panel (theme and text-size toggles, plus the manual motion override) to
// match the fixed single-identity reference design — DisplaySettings,
// PreferencesEffect, and ProfileSync are all gone with it (nothing left to
// store, mirror to the DOM, or sync to agv_profiles). prefers-reduced-motion
// is a baseline accessibility behavior, not a removed feature, so it's kept
// as a direct OS-setting read, with no local override to manage.

import { useReducedMotion } from "motion/react";

/** Whether motion should be reduced right now, per the OS setting. */
export function useReducedMotionPref(): boolean {
  return !!useReducedMotion();
}
