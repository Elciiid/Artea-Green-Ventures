"use client";

// Login — shares the same light off-white background, glass-card surface,
// and sage/forest palette as every other screen in the app (no separate
// dark-panel design system for the logged-out state anymore). Real
// Supabase email/password auth (Phase 10a) underneath.
//
// The one-click dev sign-in rows were removed for production readiness —
// they re-authenticated with zero human interaction, which doesn't reflect
// how a real user signs in. See session.ts's file header.

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import { Wordmark } from "@/components/Logo";
import { roleHome, showDevTools, useSession } from "@/lib/session";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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

  useEffect(() => {
    if (hydrated && account) router.replace(roleHome(account.role));
  }, [hydrated, account, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError("That email and password don't match an account.");
  }

  return (
    <main id="main-content" className="relative flex min-h-dvh flex-col">
      <div className="flex items-center justify-between p-6 sm:p-10">
        <Wordmark />
        {showDevTools() && (
          <span className="rounded-full border border-amber/50 bg-amber/10 px-3 py-1 text-label font-semibold uppercase tracking-[0.14em] text-amber">
            Demo build
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="glass w-full max-w-md rounded-3xl p-7 text-bone backdrop-blur-2xl sm:p-9"
        >
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
            Artea Green Ventures Home
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">AGV Home</h1>
          <p className="mt-2 text-sm leading-relaxed text-ash">
            Helping organizations navigate compliance with nature in mind.
          </p>

          <p className="mt-7 text-label font-semibold uppercase tracking-[0.16em] text-ash">
            Sign in
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
                Email
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
                className="mt-1.5 w-full rounded-xl border border-ash/20 bg-white/50 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal focus:ring-1 focus:ring-signal/40"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
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
                className="mt-1.5 w-full rounded-xl border border-ash/20 bg-white/50 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal focus:ring-1 focus:ring-signal/40"
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
              className="w-full rounded-full bg-signal py-3 text-sm font-semibold text-void transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </motion.div>

        <div className="space-y-1.5 text-center text-sm text-ash">
          <p>Welcome back, AGV team and partners.</p>
          <p>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-signal hover:brightness-110">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
