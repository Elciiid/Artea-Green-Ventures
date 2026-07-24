"use client";

// Where a freshly-invited client's email link lands. Supabase's invite
// email authenticates them and redirects here with tokens in the URL
// fragment; createBrowserClient auto-detects that (detectSessionInUrl is
// its default), so by the time this page's effect runs, a real session
// already exists — this page's only job is to ask for a first password,
// since an invited account starts with none.
//
// Deliberately NOT the existing /account password form: that form requires
// re-entering a *current* password (a reauth guard for existing users
// changing theirs) — an invited user has none yet, so that form can't be
// reused as-is. Everything else about the flow (the emailed link,
// establishing the session from it) still uses Supabase's own mechanism
// untouched.

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotionPref } from "@/lib/preferences";
import { Wordmark } from "@/components/Logo";
import { getSupabaseClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/session";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function InviteCompletePage() {
  const router = useRouter();
  const reduced = useReducedMotionPref();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await getSupabaseClient().auth.getSession();
      if (cancelled) return;
      setHasSession(!!data.session);
      setChecking(false);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

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
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setBusy(false);
        return;
      }
      router.push(roleHome("client"));
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
          <h1 className="mt-2 font-display text-3xl font-bold">Set your password</h1>

          {checking ? (
            <p className="mt-4 text-sm text-ash">Checking your invite link…</p>
          ) : !hasSession ? (
            <p className="mt-4 text-sm leading-relaxed text-ash">
              This invite link is invalid or has expired. Contact your AGV
              administrator for a new invite.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ash">
                Choose a password to finish setting up your account.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
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
                  <label
                    htmlFor="confirm"
                    className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
                  >
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
                  {busy ? "Saving…" : "Set password and continue"}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}
