"use client";

// Login — the "field sheet": terrain canvas on the left, instrument panel on
// the right. Real Supabase email/password auth (Phase 10a). The one-click
// account rows are dev-only convenience over the same real sign-in.

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import TopoField from "@/components/TopoField";
import TopoPlate from "@/components/TopoPlate";
import DisplaySettings from "@/components/DisplaySettings";
import { Wordmark } from "@/components/Logo";
import { roleHome, showDevTools, useSession } from "@/lib/session";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

const QUICK_ACCESS: { email: string; label: string; hint: string }[] = [
  {
    email: "admin@agv-demo.com",
    label: "Admin · A. Mercer",
    hint: "Sees all 3 applications. Can change statuses, add notes and choose who sees what.",
  },
  {
    email: "user1@agv-demo.com",
    label: "User · S. Whitfield",
    hint: "Sees 2 of the 3 applications. Can read but not change them.",
  },
  {
    email: "user2@agv-demo.com",
    label: "User · R. Santiago",
    hint: "Sees 1 of the 3 applications. Can read but not change it.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const reduced = useReducedMotionPref();
  const account = useSession((s) => s.account);
  const hydrated = useSession((s) => s.hydrated);
  const signIn = useSession((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showQuickAccess = showDevTools();
  const devPassword = process.env.NEXT_PUBLIC_DEV_SEED_PASSWORD ?? "";

  // Already signed in (this or a previous visit) → straight to the right home.
  // `account` is populated by the Supabase auth listener after sign-in.
  useEffect(() => {
    if (hydrated && account) router.replace(roleHome(account.role));
  }, [hydrated, account, router]);

  // One-click dev sign-in: the same real auth, using the shared dev seed
  // password. Only rendered outside production.
  async function enterAs(targetEmail: string) {
    setError(null);
    setBusy(true);
    const { error } = await signIn(targetEmail, devPassword);
    setBusy(false);
    if (error) setError(`Couldn't sign in: ${error}`);
    // on success the auth listener sets `account`, and the effect redirects.
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError("That email and password don't match an account.");
  }

  return (
    <main
      id="main-content"
      className="relative min-h-dvh lg:grid lg:grid-cols-[1.15fr_1fr]"
    >
      {/* ——— terrain canvas ——— */}
      <section className="relative flex min-h-[55dvh] flex-col justify-between gap-10 overflow-hidden p-6 sm:p-10 lg:min-h-dvh">
        {/* Dark mode keeps the full-bleed hero photo (near-black terrain art);
            it can't sit on paper, so in light mode CSS hides it and a bounded
            survey plate carries the panel instead.
            .jpg, not .jfif: static hosts serve an unknown .jfif extension as
            application/octet-stream, which Next's production image optimizer
            rejects — it only broke once deployed. */}
        <div aria-hidden className="login-hero absolute inset-0">
          <Image
            src="/images/site/login-hero.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-void/75 via-void/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-transparent" />
        </div>

        <motion.div
          variants={stagger}
          initial={reduced ? false : "hidden"}
          animate="show"
          className="relative z-10 flex h-full flex-col justify-between gap-8"
        >
          <motion.div
            variants={rise}
            className="flex items-start justify-between gap-4"
          >
            <Wordmark />
            {/* text-size/motion controls belong here too — someone who needs
                larger text needs it before they can sign in, so DisplaySettings
                stays unconditional. The "Demo build" chip is gated on the same
                fail-safe showDevTools() as the rest of the dev surfaces — it
                must not linger on a real production deploy. */}
            <span className="flex items-center gap-3">
              {showDevTools() && (
                <span className="rounded-full border border-amber/50 px-3 py-1 text-label font-semibold uppercase tracking-[0.14em] text-amber">
                  Demo build
                </span>
              )}
              <DisplaySettings />
            </span>
          </motion.div>

          <motion.div variants={rise} className="max-w-2xl">
            <p className="text-label font-semibold uppercase tracking-[0.18em] text-contour">
              Environmental compliance · Australia &amp; the Philippines
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.03] text-bone">
              Track every environmental compliance application.
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-ash sm:text-base">
              Artea Green Ventures records each application — its status,
              documents, and activity — from first submission to final report,
              for partner organizations across Australia and the Philippines.
            </p>
          </motion.div>

          {/* Light-only bounded survey plate — the contour motif as a framed
              figure rather than wallpaper. Dark mode shows the photo instead. */}
          <TopoPlate
            seed={19}
            parallax
            draw
            peaks={[
              { cx: 430, cy: 300, r0: 74, rings: 8, gap: 42 },
              { cx: 120, cy: 120, r0: 30, rings: 4, gap: 26 },
            ]}
            caption={
              <>
                <span>Field survey — seeded terrain</span>
                <span>AU + PH · EST. 2019</span>
              </>
            }
            className="login-topo-light h-40 w-full max-w-lg sm:h-48"
          />

          <p className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-label uppercase tracking-[0.16em] text-ash">
            <span>SYD −33.8688 / 151.2093</span>
            <span>MNL 14.5995 / 120.9842</span>
          </p>
        </motion.div>
      </section>

      {/* ——— instrument panel ——— */}
      <section className="relative flex items-center justify-center overflow-hidden border-t border-ash/10 bg-pine/30 p-6 py-14 sm:p-10 lg:border-l lg:border-t-0">
        {/* the contour motif lives here now: concentric survey rings behind
            the sign-in card, drifting with the pointer */}
        <TopoField
          parallax
          draw
          seed={19}
          peaks={[
            { cx: 720, cy: 430, r0: 95, rings: 9, gap: 58 },
            { cx: 250, cy: 840, r0: 40, rings: 4, gap: 34 },
          ]}
          className="opacity-55 [mask-image:radial-gradient(120%_95%_at_50%_45%,black_35%,transparent_100%)]"
        />

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
          className="relative w-full max-w-md rounded-xl border border-ash/15 bg-pine p-7 shadow-[var(--shadow-panel)] sm:p-8"
        >
          {/* surveyor's register ticks */}
          <span aria-hidden className="absolute -left-2.5 -top-3 select-none font-mono text-sm text-ash">+</span>
          <span aria-hidden className="absolute -right-2.5 -top-3 select-none font-mono text-sm text-ash">+</span>
          <span aria-hidden className="absolute -bottom-3 -left-2.5 select-none font-mono text-sm text-ash">+</span>
          <span aria-hidden className="absolute -bottom-3 -right-2.5 select-none font-mono text-sm text-ash">+</span>

          <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
            Sign in
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ash">
            {showQuickAccess
              ? "Development build. Pick a demo account below, or enter an email and password."
              : "Enter your email and password to continue."}
          </p>

          {showQuickAccess && (
            <>
              <div className="mt-6 space-y-2.5">
                <p className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
                  Demo accounts
                </p>
                {QUICK_ACCESS.map(({ email: accEmail, label, hint }) => (
                  <button
                    key={accEmail}
                    type="button"
                    onClick={() => enterAs(accEmail)}
                    disabled={busy}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg border border-ash/15 bg-void/40 px-4 py-3 text-left transition hover:border-signal/50 hover:bg-void/70 disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-display text-sm font-bold text-bone">
                        {label}
                      </span>
                      <span className="mt-0.5 block font-mono text-label text-ash">
                        {accEmail}
                      </span>
                      <span className="mt-1 block text-label text-ash">{hint}</span>
                    </span>
                    <span
                      aria-hidden
                      className="font-mono text-ash transition group-hover:translate-x-0.5 group-hover:text-signal"
                    >
                      →
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-ash/15" />
                <span className="text-label uppercase tracking-[0.14em] text-ash">
                  or sign in manually
                </span>
                <span className="h-px flex-1 bg-ash/15" />
              </div>
            </>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 font-mono text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Your password"
                className="mt-1.5 w-full rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 font-mono text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs leading-relaxed text-amber">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-signal py-3 font-display text-sm font-bold uppercase tracking-[0.1em] text-void transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
