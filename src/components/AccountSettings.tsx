"use client";

// Account settings: display name + password change.
//
// MFA (TOTP) enrollment used to live here (Phase 10c) — removed per direct
// product decision (2026-08-08), not because anything about it broke.
// isMfaVerificationFailedError()/isSeedAccount()/DEV_ACCOUNTS in session.ts
// existed only to support it and were removed in the same pass.

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isInvalidCredentialsError, useSession } from "@/lib/session";
import { updateOwnName } from "@/lib/supabase/profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AccountSettings() {
  const account = useSession((s) => s.account);
  if (!account) return null; // AppShell guarantees this, but keep types honest

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="shrink-0">
        <p className="eyebrow text-signal">Your account</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-bone sm:text-5xl">
          Account
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-ash">
          Manage how you sign in.
        </p>
      </div>

      <div className="mt-9 space-y-6">
        <section className="rounded-sm border border-ash/20 bg-pine p-6 shadow-panel sm:p-7">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-signal/15 text-lg font-semibold text-signal"
            >
              {account.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-bone">
                {account.name}
                <span className="rounded-full border border-ash/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ash">
                  {account.role}
                </span>
              </p>
              <p className="mt-1 font-mono text-xs text-ash">{account.email}</p>
            </div>
          </div>
        </section>

        <NameSection id={account.id} name={account.name} />
        <PasswordSection email={account.email} />
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————————————————————
// Display name
// ——————————————————————————————————————————————————————————————

function NameSection({ id, name }: { id: string; name: string }) {
  const setAccountName = useSession((s) => s.setAccountName);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }
    if (trimmed === name) return;

    setError(null);
    setBusy(true);
    try {
      await updateOwnName(id, trimmed);
      setAccountName(trimmed);
      toast.success("Name updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your name.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="name-heading" className="rounded-sm border border-ash/20 bg-pine p-6 shadow-panel sm:p-7">
      <h2 id="name-heading" className="eyebrow text-ash">
        Display name
      </h2>
      <p className="mt-1 text-xs font-light text-ash">
        The name shown to your team and across the portal.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex max-w-sm items-end gap-3" noValidate>
        <div className="flex-1">
          <Label htmlFor="display-name" className="text-label font-semibold uppercase tracking-[0.14em] text-ash">
            Name
          </Label>
          <Input
            id="display-name"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "name-error" : undefined}
            className="mt-1.5 border-ash/20 bg-void/70"
          />
        </div>
        <Button
          type="submit"
          disabled={busy || !value.trim() || value.trim() === name}
          className="h-auto shrink-0 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-void hover:bg-signal hover:brightness-110"
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </form>
      {error && (
        <p id="name-error" role="alert" className="mt-2 text-xs leading-relaxed text-amber">
          {error}
        </p>
      )}
    </section>
  );
}

// ——————————————————————————————————————————————————————————————
// Password change
// ——————————————————————————————————————————————————————————————

// Which password field(s) a given PasswordSection error implicates, so
// aria-invalid can land only on the field(s) actually at fault (aria-describedby
// still points every field at the shared error text — see Field below).
type InvalidFields = { current: boolean; next: boolean; confirm: boolean };
const NO_INVALID_FIELDS: InvalidFields = { current: false, next: false, confirm: false };

function PasswordSection({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<InvalidFields>(NO_INVALID_FIELDS);

  function clearError() {
    setError(null);
    setInvalidFields(NO_INVALID_FIELDS);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();

    if (next.length < 8) {
      setError("Choose a new password of at least 8 characters.");
      setInvalidFields({ current: false, next: true, confirm: false });
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don't match.");
      setInvalidFields({ current: false, next: true, confirm: true });
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
        if (isInvalidCredentialsError(reauthError)) {
          setError("Your current password is incorrect.");
          setInvalidFields({ current: true, next: false, confirm: false });
        } else {
          // Not attributable to what the user typed — leave invalidFields at
          // NO_INVALID_FIELDS (clearError() above already reset it) rather
          // than flagging a field that isn't actually at fault.
          console.error("Password-change reauth failed:", reauthError);
          setError("Something went wrong confirming your password. Try again in a moment.");
        }
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
    <section aria-labelledby="pw-heading" className="rounded-sm border border-ash/20 bg-pine p-6 shadow-panel sm:p-7">
      <h2 id="pw-heading" className="eyebrow text-ash">
        Password
      </h2>
      <p className="mt-1 text-xs font-light text-ash">
        Change the password you use to sign in.
      </p>

      <form onSubmit={onSubmit} className="mt-6 max-w-sm space-y-4" noValidate>
        <Field
          id="current-password"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          onEdit={clearError}
          errorId={error ? "pw-section-error" : undefined}
          invalid={invalidFields.current}
        />
        <Field
          id="new-password"
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint="At least 8 characters."
          onEdit={clearError}
          errorId={error ? "pw-section-error" : undefined}
          invalid={invalidFields.next}
        />
        <Field
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          onEdit={clearError}
          errorId={error ? "pw-section-error" : undefined}
          invalid={invalidFields.confirm}
        />

        {error && (
          <p id="pw-section-error" role="alert" className="text-xs leading-relaxed text-amber">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy}
          className="h-auto rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-void hover:bg-signal hover:brightness-110"
        >
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
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
  errorId,
  invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  onEdit?: () => void;
  errorId?: string;
  invalid?: boolean;
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
        aria-invalid={invalid}
        aria-describedby={errorId}
        className="mt-1.5 border-ash/20 bg-void/70 font-mono"
      />
      {hint && <p className="mt-1 text-label text-ash">{hint}</p>}
    </div>
  );
}
