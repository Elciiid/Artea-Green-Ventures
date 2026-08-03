// Minimal Vitest setup, scoped to exactly what Task 7 needs (one test file
// for AccessMatrix). No @vitejs/plugin-react: adding it pulls in an optional
// @rolldown/plugin-babel peer that wants @babel/core@8, which conflicts with
// the @babel/core@7 tree shadcn already depends on. Vitest's built-in esbuild
// transform reads tsconfig.json's "jsx": "react-jsx" on its own, so plain
// .tsx test/component files compile without it — no extra plugin needed.
import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Sibling git worktrees (this project's own convention for isolated
    // branch work, see .gitignore) live physically inside this same
    // directory tree. Without this, running from a checkout that still has
    // worktrees on disk picks up their test files too, each importing its
    // own node_modules/react — causing cross-copy "invalid hook call"
    // failures that have nothing to do with this checkout's own code.
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  },
});
