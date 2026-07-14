"use client";

// Login — the "field sheet": terrain canvas on the left, instrument panel
// on the right. Mock auth: either demo address, any password.

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import TopoField from "@/components/TopoField";
import { Wordmark } from "@/components/Logo";
import { roleHome, useSession } from "@/lib/session";

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
    label: "Admin",
    hint: "All applications · edit controls · manage user access",
  },
  {
    email: "user1@agv-demo.com",
    label: "User · S. Whitfield",
    hint: "Two assigned engagements",
  },
  {
    email: "user2@agv-demo.com",
    label: "User · R. Santiago",
    hint: "One assigned engagement",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const account = useSession((s) => s.account);
  const hydrated = useSession((s) => s.hydrated);
  const signIn = useSession((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Already signed in from a previous visit → straight to the right home.
  useEffect(() => {
    if (hydrated && account) router.replace(roleHome(account.role));
  }, [hydrated, account, router]);

  function enterAs(targetEmail: string) {
    const acc = signIn(targetEmail);
    if (acc) router.push(roleHome(acc.role));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const acc = signIn(email);
    if (acc) {
      router.push(roleHome(acc.role));
    } else {
      setError(
        "No matching demo account. Use admin@, user1@ or user2@agv-demo.com."
      );
    }
  }

  return (
    <main className="relative min-h-dvh lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* ——— terrain canvas ——— */}
      <section className="relative flex min-h-[55dvh] flex-col justify-between gap-10 overflow-hidden p-6 sm:p-10 lg:min-h-dvh">
        {/* The hero art is generated to the palette (near-black, glowing
            contours), so it runs unfiltered — no photo treatment. The
            gradients below are for text legibility only. */}
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/images/site/login-hero.jfif"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/75 to-void/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/50" />
        </div>

        {/* the SVG motif still drives the pointer parallax, kept quiet so it
            reads with the art rather than competing with it */}
        <TopoField parallax draw className="opacity-35" />

        <motion.div
          variants={stagger}
          initial={reduced ? false : "hidden"}
          animate="show"
          className="relative z-10 flex h-full flex-col justify-between gap-10"
        >
          <motion.div
            variants={rise}
            className="flex items-start justify-between gap-4"
          >
            <Wordmark />
            <span className="rounded-full border border-amber/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber">
              Demo build
            </span>
          </motion.div>

          <motion.div variants={rise} className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-contour">
              Environmental compliance · AU + PH
            </p>
            <h1 className="mt-5 font-display text-[clamp(3.4rem,8vw,7rem)] font-black leading-[0.92] tracking-[-0.035em] text-bone">
              Compliance,
              <br />
              <span className="text-signal">mapped.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-ash sm:text-base">
              Every environmental approval tracked from submission to
              sign-off — every site, every stage, one source of truth.
            </p>
          </motion.div>

          <motion.div
            variants={rise}
            className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ash/80"
          >
            <span>SYD −33.8688 / 151.2093</span>
            <span>MNL 14.5995 / 120.9842</span>
            <span className="text-ash/50">AU + PH · EST. 2019</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ——— instrument panel ——— */}
      <section className="relative flex items-center justify-center border-t border-ash/10 bg-pine/30 p-6 py-14 sm:p-10 lg:border-l lg:border-t-0">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
          className="relative w-full max-w-md rounded-xl border border-ash/15 bg-pine p-7 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.7)] sm:p-8"
        >
          {/* surveyor's register ticks */}
          <span aria-hidden className="absolute -left-2.5 -top-3 select-none font-mono text-sm text-ash/50">+</span>
          <span aria-hidden className="absolute -right-2.5 -top-3 select-none font-mono text-sm text-ash/50">+</span>
          <span aria-hidden className="absolute -bottom-3 -left-2.5 select-none font-mono text-sm text-ash/50">+</span>
          <span aria-hidden className="absolute -bottom-3 -right-2.5 select-none font-mono text-sm text-ash/50">+</span>

          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-signal">
            Access / Sign in
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ash">
            Demo mode — enter any demo address, any password.
          </p>

          <div className="mt-6 space-y-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash/70">
              One-click demo access
            </p>
            {QUICK_ACCESS.map(({ email: accEmail, label, hint }) => (
              <button
                key={accEmail}
                type="button"
                onClick={() => enterAs(accEmail)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-ash/15 bg-void/40 px-4 py-3 text-left transition hover:border-signal/50 hover:bg-void/70"
              >
                <span>
                  <span className="block font-display text-sm font-bold text-bone">
                    {label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-ash">
                    {accEmail}
                  </span>
                  <span className="mt-1 block text-[11px] text-ash/70">
                    {hint}
                  </span>
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
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash/60">
              or manual entry
            </span>
            <span className="h-px flex-1 bg-ash/15" />
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="admin@agv-demo.com"
                className="mt-1.5 w-full rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 font-mono text-sm text-bone outline-none transition placeholder:text-ash/40 focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="anything works"
                className="mt-1.5 w-full rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 font-mono text-sm text-bone outline-none transition placeholder:text-ash/40 focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
              />
            </div>

            {error && (
              <p role="alert" className="font-mono text-[11px] leading-relaxed text-amber">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-signal py-3 font-display text-sm font-bold uppercase tracking-[0.1em] text-void transition hover:brightness-110 active:scale-[0.99]"
            >
              Enter portal
            </button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
