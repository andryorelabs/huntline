import { defineConfig } from "oxlint";

/**
 * The jobship lint policy.
 *
 * - `plugins`: the built-in plugins for TypeScript, unicorn, oxc, import,
 *   promise, node and jest rules.
 * - `jsPlugins`: the project-local rules in `tools/oxlint/local-plugin.ts`,
 *   under the `local` alias.
 * - `categories`: correctness, suspicious and perf are errors, so a new rule
 *   in those categories fails the check instead of arriving as a warning.
 * - `options`: an unused disable directive is an error, so a suppression that
 *   stops being needed is deleted.
 * - `rules`: `local/no-non-doc-comments` allows JSDoc blocks and tool
 *   directives only, and `local/require-description` requires ` -- reason` on
 *   every disable directive.
 */
export default defineConfig({
  plugins: ["typescript", "unicorn", "oxc", "import", "promise", "node", "jest"],
  jsPlugins: ["./tools/oxlint/local-plugin.ts"],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
  },
  options: {
    reportUnusedDisableDirectives: "error",
  },
  rules: {
    "local/no-non-doc-comments": "error",
    "local/require-description": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/return-await": ["error", "error-handling-correctness-only"],
    "typescript/unbound-method": "error",
    "typescript/only-throw-error": "error",
    "typescript/require-await": "error",
    "typescript/restrict-template-expressions": "error",
    "typescript/no-deprecated": "error",
    "typescript/no-unnecessary-type-assertion": "error",
    "typescript/prefer-promise-reject-errors": "error",
    "typescript/switch-exhaustiveness-check": "error",
  },
  overrides: [
    {
      files: ["**/*.test.ts"],
      rules: {
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/no-disabled-tests": "error",
      },
    },
  ],
  ignorePatterns: ["**/node_modules/**", "dist/**", "coverage/**", ".claude/**"],
});
