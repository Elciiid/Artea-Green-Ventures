"use client";

// Display settings: text size + motion. Native radio inputs are used rather
// than custom buttons so grouping, arrow-key navigation and announcement all
// come from the platform; the visible pills are styled labels.
//
// This is the accessibility slice of the wider user-settings surface. The
// security/sign-in half arrives with real auth in Phase 10c.

import { useEffect, useId, useRef, useState } from "react";
import {
  MOTION_PREFS,
  TEXT_SIZES,
  THEMES,
  usePreferences,
  type MotionPref,
  type TextSize,
  type ThemePref,
} from "@/lib/preferences";

export default function DisplaySettings() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const textSize = usePreferences((s) => s.textSize);
  const motion = usePreferences((s) => s.motion);
  const theme = usePreferences((s) => s.theme);
  const setTextSize = usePreferences((s) => s.setTextSize);
  const setMotion = usePreferences((s) => s.setMotion);
  const setTheme = usePreferences((s) => s.setTheme);

  // Close on outside click or Escape, and return focus to the trigger.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        wrapRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Display settings"
        className="inline-flex items-center gap-1.5 rounded-full border border-ash/25 px-3 py-1.5 text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:border-signal/60 hover:text-signal"
      >
        <span aria-hidden className="font-display font-bold">
          Aa
        </span>
        <span className="hidden sm:inline">Display</span>
      </button>

      {open && (
        <div
          id={panelId}
          // On narrow screens the button sits mid-header, so a right-aligned
          // dropdown would hang off the left edge — pin it to the viewport
          // there, and only anchor it to the button from sm up.
          className="fixed left-4 right-4 top-20 z-50 rounded-xl border border-ash/20 bg-pine p-4 shadow-[var(--shadow-pop)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64"
        >
          <PrefGroup
            legend="Appearance"
            name="theme"
            options={THEMES}
            value={theme}
            onChange={(v) => setTheme(v as ThemePref)}
          />

          <div className="mt-4 border-t border-ash/10 pt-4">
            <PrefGroup
              legend="Text size"
              name="text-size"
              options={TEXT_SIZES}
              value={textSize}
              onChange={(v) => setTextSize(v as TextSize)}
            />
          </div>

          <div className="mt-4 border-t border-ash/10 pt-4">
            <PrefGroup
              legend="Motion"
              name="motion"
              options={MOTION_PREFS}
              value={motion}
              onChange={(v) => setMotion(v as MotionPref)}
            />
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-ash">
              &ldquo;System&rdquo; follows your device setting. Choose
              &ldquo;Reduced&rdquo; to turn off animation even if your device
              doesn&apos;t ask for it.
            </p>
          </div>

          <p className="mt-4 border-t border-ash/10 pt-3 text-[0.6875rem] text-ash">
            Saved in this browser.
          </p>
        </div>
      )}
    </div>
  );
}

function PrefGroup({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-label font-semibold uppercase tracking-[0.12em] text-ash">
        {legend}
      </legend>
      <div className="mt-2 flex gap-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex-1">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="block cursor-pointer rounded-md border border-ash/25 px-2 py-1.5 text-center text-label text-ash transition hover:border-ash/50 peer-checked:border-signal peer-checked:bg-signal peer-checked:text-void peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
