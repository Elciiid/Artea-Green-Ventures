import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

// Accessibility linting is the point of this config: jsx-a11y runs on every
// component so a11y violations surface during development instead of being
// invisible (which was the state before Phase 14a). There is no CI yet —
// `npm run lint` is the gate for now.
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "eslint.config.mjs",
      // Sibling git worktrees (this project's own convention for isolated
      // branch work, see .gitignore) live physically inside this same
      // directory tree, each with its own node_modules — without this,
      // running from a checkout that still has worktrees on disk lints
      // every one of their dependency trees too.
      ".worktrees/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,jsx,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.{js,mjs,jsx,ts,tsx}"],
    ...reactHooks.configs["recommended-latest"],
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The design system leans on custom controls (the access matrix uses
      // buttons with role="checkbox"); keep these as errors so any new one
      // has to carry proper keyboard + labelling semantics.
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-static-element-interactions": "error",
    },
  }
);
