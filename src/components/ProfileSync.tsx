"use client";

// Bridges the display preferences (Phase 14a/9 localStorage store) with the
// signed-in user's agv_profiles row.
//
// The edge case, handled per the Phase 10a spec:
//   • Anonymous / pre-login: localStorage is the source of truth (unchanged),
//     so the login screen's DisplaySettings work before anyone is identified.
//   • On login: reconcile once —
//       - if the profile has never been customized (all defaults) but this
//         browser has non-default local prefs, push local → profile, so the
//         choices someone made on the sign-in screen carry into their account;
//       - otherwise the profile wins (apply profile → local), so preferences
//         set on another device follow the person here.
//   • While signed in: write local changes through to the profile, so it stays
//     the cross-device source of truth.

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session";
import {
  usePreferences,
  type MotionPref,
  type TextSize,
  type ThemePref,
} from "@/lib/preferences";

type PrefRow = { text_size: TextSize; motion: MotionPref; theme: ThemePref };

const LOCAL_DEFAULT = { textSize: "default", motion: "system", theme: "light" } as const;

function isProfileUncustomized(p: PrefRow): boolean {
  return (
    p.text_size === LOCAL_DEFAULT.textSize &&
    p.motion === LOCAL_DEFAULT.motion &&
    p.theme === LOCAL_DEFAULT.theme
  );
}

export default function ProfileSync() {
  const accountId = useSession((s) => s.account?.id ?? null);

  const textSize = usePreferences((s) => s.textSize);
  const motion = usePreferences((s) => s.motion);
  const theme = usePreferences((s) => s.theme);
  const prefsHydrated = usePreferences((s) => s.hydrated);

  // which account we've already reconciled, so the one-shot runs once per login
  const reconciledFor = useRef<string | null>(null);
  // suppress write-through while we're applying profile → local
  const applyingRemote = useRef(false);

  // ——— one-shot reconciliation on login ———
  useEffect(() => {
    if (!accountId || !prefsHydrated) return;
    if (reconciledFor.current === accountId) return;
    reconciledFor.current = accountId;

    const supabase = getSupabaseClient();
    let cancelled = false;

    (async () => {
      const { data: raw, error } = await supabase
        .from("agv_profiles")
        .select("text_size, motion, theme")
        .eq("id", accountId)
        .single();
      if (cancelled || error || !raw) return;
      const data = raw as PrefRow;

      const local = usePreferences.getState();
      const localCustomized =
        local.textSize !== LOCAL_DEFAULT.textSize ||
        local.motion !== LOCAL_DEFAULT.motion ||
        local.theme !== LOCAL_DEFAULT.theme;

      if (isProfileUncustomized(data) && localCustomized) {
        // migrate this browser's pre-login choices up into the account
        await supabase
          .from("agv_profiles")
          .update({ text_size: local.textSize, motion: local.motion, theme: local.theme })
          .eq("id", accountId);
      } else {
        // profile wins — apply it to local without echoing back
        applyingRemote.current = true;
        local.setTextSize(data.text_size);
        local.setMotion(data.motion);
        local.setTheme(data.theme);
        applyingRemote.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, prefsHydrated]);

  // reset the one-shot guard on sign-out
  useEffect(() => {
    if (!accountId) reconciledFor.current = null;
  }, [accountId]);

  // ——— write-through while signed in ———
  useEffect(() => {
    if (!accountId || applyingRemote.current) return;
    if (reconciledFor.current !== accountId) return; // wait until reconciled
    const supabase = getSupabaseClient();
    const t = window.setTimeout(() => {
      // NB: the postgrest builder is a lazy thenable — the request only fires
      // when the promise is consumed, so this must be awaited (or .then()'d),
      // not built and dropped.
      void (async () => {
        const { error } = await supabase
          .from("agv_profiles")
          .update({ text_size: textSize, motion, theme })
          .eq("id", accountId);
        if (error) {
          console.error("ProfileSync: failed to save preferences", error.message);
        }
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [accountId, textSize, motion, theme]);

  return null;
}
