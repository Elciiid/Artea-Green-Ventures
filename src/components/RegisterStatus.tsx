// src/components/RegisterStatus.tsx
//
// Loading/error placeholder for the applications register, styled to match
// ApplicationRegister's header and ruled-table framing so the swap into the
// real table doesn't jump. New in Phase 10b-2 — Supabase reads aren't
// synchronous the way the old mock store was. The spinner reuses the exact
// markup AppShell already uses for its own hydration gate.

export default function RegisterStatus({
  eyebrow,
  title,
  kind,
  message,
}: {
  eyebrow: string;
  title: string;
  kind: "loading" | "error";
  message?: string;
}) {
  return (
    <div>
      <p className="text-label font-semibold uppercase tracking-[0.18em] text-signal">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-bone sm:text-5xl">
        {title}
      </h1>
      <div className="mt-9 border-y-2 border-bone/80 py-16 text-center">
        {kind === "loading" ? (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-3 text-sm text-ash"
          >
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
            />
            Loading applications…
          </p>
        ) : (
          <>
            <h2 className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
              We couldn&apos;t load {title.toLowerCase()}
            </h2>
            <p className="mt-2 text-sm text-ash">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
