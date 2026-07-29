"use client";

// Account settings (Phase 10c): password change + TOTP MFA enrollment.
//
// Scope boundaries held deliberately:
//  • This builds the MFA *mechanism* only. Gating any action on MFA/verification
//    status is Phase 12+11's job (the verification_level flag) — nothing here
//    enforces AAL2.
//  • Dev/staging seed accounts are excluded from MFA enrollment — see
//    isSeedAccount() in session.ts for the current reasoning (a holdover
//    from a now-removed auth-bypass tool, left unchanged deliberately).

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSeedAccount, showDevTools, useSession, type Account } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountSettings() {
  const account = useSession((s) => s.account);
  if (!account) return null; // AppShell guarantees this, but keep types honest

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-bone">Account</h1>
        <p className="mt-2 text-sm text-ash">
          Manage how you sign in.
        </p>
        <dl className="mt-5 grid gap-3 border-t border-ash/15 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
              Signed in as
            </dt>
            <dd className="mt-1 font-mono text-sm text-bone">{account.email}</dd>
          </div>
          <div>
            <dt className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
              Role
            </dt>
            <dd className="mt-1 text-sm capitalize text-bone">{account.role}</dd>
          </div>
        </dl>
      </div>

      <PasswordSection email={account.email} />
      <MfaSection account={account} />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————
// Password change
// ——————————————————————————————————————————————————————————————

function PasswordSection({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (next.length < 8) {
      setError("Choose a new password of at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    if (next === current) {
      setError("Your new password must be different from your current one.");
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      // Reconfirm the current password before changing it. Supabase's
      // updateUser authenticates on the session alone, so this re-auth is what
      // supplies the "enter your current password" check the flow should have.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (reauthError) {
        setError("Your current password is incorrect.");
        setBusy(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
      });
      if (updateError) {
        setError(updateError.message);
        setBusy(false);
        return;
      }

      toast.success("Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="pw-heading" className="rounded-xl border border-ash/15 bg-pine/40 p-6 sm:p-7">
      <h2 id="pw-heading" className="font-display text-lg font-bold text-bone">
        Password
      </h2>
      <p className="mt-1.5 text-sm text-ash">
        Change the password you use to sign in.
      </p>

      <form onSubmit={onSubmit} className="mt-6 max-w-sm space-y-4" noValidate>
        <Field
          id="current-password"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          onEdit={() => setError(null)}
        />
        <Field
          id="new-password"
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint="At least 8 characters."
          onEdit={() => setError(null)}
        />
        <Field
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          onEdit={() => setError(null)}
        />

        {error && (
          <p role="alert" className="text-xs leading-relaxed text-amber">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-signal px-5 py-2.5 font-display text-sm font-bold uppercase tracking-[0.1em] text-void transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

// ——————————————————————————————————————————————————————————————
// MFA (TOTP)
// ——————————————————————————————————————————————————————————————

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: "verified" | "unverified";
  created_at: string;
};

type Pending = { factorId: string; qrCode: string; secret: string };

function MfaSection({ account }: { account: Account }) {
  // Seed accounts are excluded from MFA in dev/staging (see file header).
  const excluded = showDevTools() && isSeedAccount(account.email);

  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const totp = ((data?.all ?? []) as Factor[]).filter(
        (f) => f.factor_type === "totp" && f.status === "verified"
      );
      setFactors(totp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load security keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (excluded) {
      setLoading(false);
      return;
    }
    refresh();
  }, [excluded, refresh]);

  async function startEnroll() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const supabase = getSupabaseClient();

      // Clear any abandoned, unverified factors first so a fresh enrollment
      // never collides with a leftover from a cancelled attempt.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of ((existing?.all ?? []) as Factor[]).filter(
        (f) => f.status === "unverified"
      )) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (enrollError) throw enrollError;
      setPending({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pending.factorId,
        code: code.trim(),
      });
      if (verifyError) {
        setError("That code didn't match. Check your authenticator app and try again.");
        setBusy(false);
        return;
      }
      setPending(null);
      setCode("");
      setNotice("Authenticator app added.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (!pending) return;
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.mfa.unenroll({ factorId: pending.factorId });
    } catch {
      /* best-effort cleanup */
    } finally {
      setPending(null);
      setCode("");
      setError(null);
      setBusy(false);
    }
  }

  async function remove(factorId: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;
      setNotice("Authenticator app removed.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="mfa-heading" className="rounded-xl border border-ash/15 bg-pine/40 p-6 sm:p-7">
      <h2 id="mfa-heading" className="font-display text-lg font-bold text-bone">
        Two-step verification
      </h2>
      <p className="mt-1.5 text-sm text-ash">
        Add an authenticator app for a one-time code at sign-in. Optional.
      </p>

      {excluded ? (
        <p className="mt-5 rounded-lg border border-ash/20 bg-void/40 px-4 py-3 text-sm text-ash">
          Two-step verification is turned off for the shared demo accounts on
          purpose. Sign in with a real account to set it up.
        </p>
      ) : loading ? (
        <p role="status" className="mt-5 text-sm text-ash">
          Loading…
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {/* enrolled factors */}
          {factors.length > 0 && (
            <ul className="space-y-2">
              {factors.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-ash/15 bg-void/40 px-4 py-3"
                >
                  <span>
                    <span className="block text-sm text-bone">
                      {f.friendly_name || "Authenticator app"}
                    </span>
                    <span className="mt-0.5 block text-label text-ash">
                      Added {formatDate(f.created_at.slice(0, 10))}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    disabled={busy}
                    className="text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:text-amber disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* enrollment flow */}
          {pending ? (
            <form onSubmit={verify} className="rounded-lg border border-ash/15 bg-void/40 p-4 sm:p-5">
              <p className="text-sm text-bone">
                Scan this with your authenticator app, then enter the 6-digit
                code it shows.
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* qr_code is an SVG data URI from Supabase — a plain img is
                    the right tool for a data URI (no next/image optimization
                    applies to inline SVG). */}
                <img
                  src={pending.qrCode}
                  alt="QR code for setting up your authenticator app"
                  width={160}
                  height={160}
                  className="h-40 w-40 shrink-0 rounded-md bg-white p-2"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
                    Or enter this key manually
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-bone">
                    {pending.secret}
                  </p>

                  <label
                    htmlFor="mfa-code"
                    className="mt-4 block text-label font-semibold uppercase tracking-[0.14em] text-ash"
                  >
                    6-digit code
                  </label>
                  <input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ""));
                      setError(null);
                    }}
                    placeholder="000000"
                    className="mt-1.5 w-40 rounded-md border border-ash/20 bg-void/70 px-3.5 py-2.5 font-mono text-sm tracking-[0.3em] text-bone outline-none transition placeholder:text-ash focus:border-signal/70 focus:ring-1 focus:ring-signal/40"
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-3 text-xs leading-relaxed text-amber">
                  {error}
                </p>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="rounded-md bg-signal px-5 py-2.5 font-display text-sm font-bold uppercase tracking-[0.1em] text-void transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  {busy ? "Verifying…" : "Verify & turn on"}
                </button>
                <button
                  type="button"
                  onClick={cancelEnroll}
                  disabled={busy}
                  className="text-label font-semibold uppercase tracking-[0.12em] text-ash transition hover:text-bone disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              {error && (
                <p role="alert" className="mb-3 text-xs leading-relaxed text-amber">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="mb-3 text-xs leading-relaxed text-contour">
                  {notice}
                </p>
              )}
              <button
                type="button"
                onClick={startEnroll}
                disabled={busy}
                className="rounded-md border border-ash/30 px-5 py-2.5 text-sm font-semibold text-bone transition hover:border-signal/60 hover:text-signal disabled:opacity-50"
              >
                {busy
                  ? "Working…"
                  : factors.length > 0
                    ? "Add another authenticator app"
                    : "Add authenticator app"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ——————————————————————————————————————————————————————————————

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  onEdit,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  onEdit?: () => void;
}) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="text-label font-semibold uppercase tracking-[0.14em] text-ash"
      >
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onEdit?.();
        }}
        className="mt-1.5 border-ash/20 bg-void/70 font-mono"
      />
      {hint && <p className="mt-1 text-label text-ash">{hint}</p>}
    </div>
  );
}
