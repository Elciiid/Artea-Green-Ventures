// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// for every test file. Scoped globally via vitest.config.ts's setupFiles
// since that's a one-line, test-framework-level concern, not something that
// belongs inlined per test file.
import "@testing-library/jest-dom/vitest";

// Testing Library's per-test DOM cleanup only auto-registers itself against
// a global `afterEach` (as Jest provides by default). This config doesn't set
// `test.globals: true`, so `afterEach` isn't global here — without this,
// each test's render stays mounted into the next test's document, and
// queries that assume a single instance of a role/label become ambiguous
// across tests.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => cleanup());

// jsdom doesn't implement window.matchMedia. sonner's <Toaster> calls it
// unconditionally on mount (even with a fixed theme="light" prop, per its
// source) to watch for OS dark-mode changes, so without this stub rendering
// the real Toaster (needed for the toast-error test case) throws
// "window.matchMedia is not a function". This is a jsdom-environment gap,
// not AccessMatrix-specific behavior, hence living here rather than in the
// test file.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
