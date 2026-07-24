"use client";

// Login — shares the same light off-white background, glass-card surface,
// and sage/forest palette as every other screen in the app (no separate
// dark-panel design system for the logged-out state anymore). Real
// Supabase email/password auth (Phase 10a) underneath; the one-click
// account rows are dev-only convenience over the same real sign-in.

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import { Wordmark } from "@/components/Logo";
import { roleHome, showDevTools, useSession } from "@/lib/session";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const QUICK_ACCESS: { email: string; label: string; hint: string }[] = [
  {
    email: "admin@agv-demo.com",
    label: "Admin · A. Mercer",
    hint: "Sees all 3 applications. Can change statuses, add notes and choose who sees what.",
  },
  {
    email: "user1@agv-demo.com",
    label: "Staff · S. Whitfield",
    hint: "Sees 2 of the 3 applications. Can update status and add notes.",
  },
  {
    email: "user2@agv-demo.com",
    label: "Staff · R. Santiago",
    hint: "Sees 1 of the 3 applications. Can update status and add notes.",
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

  useEffect(() => {
    if (hydrated && account) router.replace(roleHome(account.role));
  }, [hydrated, account, router]);

  async function enterAs(targetEmail: string) {
    setError(null);
    setBusy(true);
    const { error } = await signIn(targetEmail, devPassword);
    setBusy(false);
    if (error) setError(`Couldn't sign in: ${error}`);
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

          {showQuickAccess && (
            <div className="mt-4 space-y-2">
              {QUICK_ACCESS.map(({ email: accEmail, label, hint }) => (
                <button
                  key={accEmail}
                  type="button"
                  onClick={() => enterAs(accEmail)}
                  disabled={busy}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-ash/15 bg-white/35 px-4 py-2.5 text-left transition hover:border-signal/40 hover:bg-white/55 disabled:opacity-50"
                >
                  <span>
                    <span className="block font-display text-sm font-bold">{label}</span>
                    <span className="mt-0.5 block text-label text-ash">{hint}</span>
                  </span>
                  <span aria-hidden className="text-signal transition group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-ash/20" />
                <span className="text-label uppercase tracking-[0.14em] text-ash">or sign in manually</span>
                <span className="h-px flex-1 bg-ash/20" />
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
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
