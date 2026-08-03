// The rendering half of the loading/error/empty contract that
// `useAsyncResource` handles the state half of.
//
// This is a *behavior* wrapper, not a visual one: every call site passes its
// own container `className` and its own `emptyContent`, so migrating a surface
// onto it doesn't restyle that surface. What it does standardize is the part
// the surfaces kept getting wrong independently — in particular `role="alert"`
// on the error message, which none of the five surfaces had before, so a
// screen reader user was never told a surface had failed to load.
//
// The spinner markup is copied verbatim from the version AccessMatrix and the
// applications register already used (which itself matches AppShell's
// hydration gate) rather than reinvented, so the loading state keeps looking
// the way it already did.

import type { ReactNode } from "react";

export default function SurfaceState({
  loading,
  loadingLabel,
  error,
  errorHeading,
  errorHeadingLevel = "h2",
  empty,
  emptyContent,
  className,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  /** The message to announce, or null when the surface isn't in an error state. */
  error: string | null;
  /** Shown above the error message on surfaces that previously had a heading here. Omit to keep the plain single-message look (PersonDirectory, ActivityLog never had one). */
  errorHeading?: string;
  /** Defaults to h2 (correct when this surface's own page heading is an h1, e.g. AdminDashboard/UserPortalView). Pass "h3" when a section heading between the page h1 and this surface is already an h2 (e.g. AccessMatrix, nested under PeopleSectionHeading's h2), so the error heading nests correctly instead of becoming a sibling. */
  errorHeadingLevel?: "h2" | "h3";
  empty: boolean;
  /** Each surface writes its own empty copy — there is no generic default. */
  emptyContent: ReactNode;
  /** The container styling this call site already used for these states. */
  className?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className={className}>
        <p
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-3 text-sm text-ash"
        >
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ash/25 border-t-signal"
          />
          {loadingLabel}
        </p>
      </div>
    );
  }

  if (error) {
    const ErrorHeadingTag = errorHeadingLevel;
    return (
      <div className={className}>
        {errorHeading && (
          <ErrorHeadingTag className="text-label font-semibold uppercase tracking-[0.16em] text-ash">
            {errorHeading}
          </ErrorHeadingTag>
        )}
        <p role="alert" className="text-sm text-amber">
          {error}
        </p>
      </div>
    );
  }

  if (empty) {
    return <div className={className}>{emptyContent}</div>;
  }

  return <>{children}</>;
}
