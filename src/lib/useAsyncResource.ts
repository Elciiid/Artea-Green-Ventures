// Shared initial-load state for a client surface that reads from Supabase.
//
// Before this hook, AccessMatrix, AdminDashboard, UserPortalView (and, in a
// slightly different shape, PersonDirectory and ActivityLog) each hand-rolled
// the same `{ status: "loading" | "error" | "ready" }` union plus a
// `let cancelled = false` guard inside a useEffect — five copies of one
// contract, which is how the three surfaces drifted apart in the first place.
//
// Scope note: this targets the *initial* load (and an explicit reload of that
// same load, via `refetch`). It is deliberately not a general-purpose data
// layer — narrower post-mutation refetches that update only part of a
// surface's data (e.g. AccessMatrix re-reading only the live grants after a
// single toggle) stay as bespoke local state.

import { useCallback, useEffect, useState, type DependencyList } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  fallbackMessage: string
): { state: AsyncState<T>; refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  // Bumped by refetch() to re-run the effect below on demand.
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error && e.message ? e.message : fallbackMessage,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // The caller owns this effect's dependencies: `deps` is passed straight
    // through, exactly as it would be if the effect were written inline at the
    // call site. `fetcher`/`fallbackMessage` are intentionally excluded — a
    // caller passing an inline arrow fetcher would otherwise re-fetch on every
    // render — so this rule can't be statically satisfied here. `deps` must
    // also be a fixed-length array across renders for a given call site, since
    // React requires a stable-length dependency array per useEffect call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  const refetch = useCallback(() => {
    setReloadCount((n) => n + 1);
  }, []);

  return { state, refetch };
}
