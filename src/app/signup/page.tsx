"use client";

// Public sign-up — serves both staff and clients from one form.
// src/app/api/auth/signup/route.ts decides which: an
// @arteagreenventures.com email becomes staff (real signUp(), Supabase sends
// its usual verification email); any other email becomes a client, created
// already-verified via the Admin API with no email sent at all — clients
// start with zero application access regardless (an admin still has to
// grant it via /admin/access), so there's no invite/verification round-trip
// to wait on. This page never calls supabase.auth.signUp() directly — it
// POSTs to the route, so the domain branch can't be skipped from devtools.
// On success it hydrates its own browser session from the tokens the route
// returns (setSession), since the actual account creation happened
// server-side, then redirects based on the role the route resolved.
//
// Shares the login page's exact visual language (same glass card, inputs,
// button) rather than inventing a second sign-up-flow identity.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import { Wordmark } from "@/components/Logo";
import { getSupabaseClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/session";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function SignUpPage() {
  const router = useRouter();
  const reduced = useReducedMotionPref();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      if (result.session) {
        // The route already created the account server-side — hydrate this
        // browser's own session from the tokens it returned. onAuthStateChange
        // (session.ts) picks this up from here. Redirect based on whichever
        // role the route resolved (staff → /home, client → /portal).
        const supabase = getSupabaseClient();
        const { error: setErr } = await supabase.auth.setSession(result.session);
        if (setErr) {
          setError(setErr.message);
          setBusy(false);
          return;
        }
        router.push(roleHome(result.role === "client" ? "client" : "staff"));
        return;
      }
      // No session back: this only happens on the staff path, when this
      // Supabase project's own "Confirm email" setting requires it.
      setPendingConfirmation(true);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="relative flex min-h-dvh flex-col">
      <div className="flex items-center justify-between p-6 sm:p-10">
        <Wordmark />
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
          <h1 className="mt-2 font-display text-3xl font-bold">Create an account</h1>
          <p className="mt-2 text-sm leading-relaxed text-ash">
            AGV team? Use your @arteagreenventures.com email — we&apos;ll send
            a quick verification link. Client of ours? Use your own work
            email and you&apos;ll go straight to your applications.
          </p>

          {pendingConfirmation ? (
            <div className="mt-6 rounded-xl border border-ash/20 bg-white/40 px-4 py-4 text-sm text-bone">
              <p className="font-semibold">Check your email to confirm your account.</p>
              <p className="mt-1.5 text-ash">
                We sent a confirmation link to <span className="text-bone">{email}</span>.
                Once you&apos;ve confirmed, come back and sign in.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block text-sm font-semibold text-signal hover:brightness-110"
              >
                Back to sign in →
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="name" className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="Your name"
                  className="mt-1.5 w-full rounded-xl border border-ash/20 bg-white/50 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal focus:ring-1 focus:ring-signal/40"
                />
              </div>
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
                  placeholder="you@arteagreenventures.com"
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="mt-1.5 w-full rounded-xl border border-ash/20 bg-white/50 px-3.5 py-2.5 text-sm text-bone outline-none transition placeholder:text-ash focus:border-signal focus:ring-1 focus:ring-signal/40"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError(null);
                  }}
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
                {busy ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}
        </motion.div>

        <p className="text-center text-sm text-ash">
          Already have an account?{" "}
          <Link href="/" className="font-semibold text-signal hover:brightness-110">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
