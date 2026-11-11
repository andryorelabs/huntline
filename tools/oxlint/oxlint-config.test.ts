import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { OxlintConfig } from "oxlint";
import configuration from "../../oxlint.config.ts";

const config: OxlintConfig = configuration;
const repositoryRoot = join(import.meta.dir, "..", "..");

const rulesCarriedOverFromTheJsonConfig = [
  "typescript/no-explicit-any",
  "typescript/no-floating-promises",
  "typescript/no-misused-promises",
  "typescript/await-thenable",
  "typescript/no-unsafe-argument",
  "typescript/no-unsafe-assignment",
  "typescript/no-unsafe-call",
  "typescript/no-unsafe-member-access",
  "typescript/no-unsafe-return",
  "typescript/unbound-method",
  "typescript/only-throw-error",
  "typescript/require-await",
  "typescript/restrict-template-expressions",
  "typescript/no-deprecated",
  "typescript/no-unnecessary-type-assertion",
  "typescript/prefer-promise-reject-errors",
  "typescript/switch-exhaustiveness-check",
];

describe("oxlint.config.ts", () => {
  test("reports unused disable directives as errors", () => {
    expect(config.options?.reportUnusedDisableDirectives).toBe("error");
  });

  test("keeps correctness, suspicious and perf categories as errors", () => {
    expect(config.categories).toEqual({
      correctness: "error",
      suspicious: "error",
      perf: "error",
    });
  });

  test("keeps the plugins and loads the local jsPlugin", () => {
    expect(config.plugins).toEqual([
      "typescript",
      "unicorn",
      "oxc",
      "import",
      "promise",
      "node",
      "jest",
    ]);
    expect(config.jsPlugins).toEqual(["./tools/oxlint/local-plugin.ts"]);
    expect(existsSync(join(repositoryRoot, "tools", "oxlint", "local-plugin.ts"))).toBe(true);
  });

  test("keeps every rule of the JSON config at error", () => {
    for (const ruleName of rulesCarriedOverFromTheJsonConfig) {
      expect(config.rules?.[ruleName]).toBe("error");
    }
    expect(config.rules?.["typescript/return-await"]).toEqual([
      "error",
      "error-handling-correctness-only",
    ]);
  });

  test("denies the two local rules", () => {
    expect(config.rules?.["local/no-non-doc-comments"]).toBe("error");
    expect(config.rules?.["local/require-description"]).toBe("error");
  });

  test("keeps the test-file rules at error", () => {
    const testOverride = config.overrides?.find((override) =>
      override.files.includes("**/*.test.ts"),
    );
    expect(testOverride?.rules).toEqual({
      "jest/no-focused-tests": "error",
      "jest/no-identical-title": "error",
      "jest/no-disabled-tests": "error",
    });
  });

  test("keeps the ignored paths", () => {
    expect(config.ignorePatterns).toEqual([
      "**/node_modules/**",
      "dist/**",
      "coverage/**",
      ".claude/**",
    ]);
  });

  test("replaced the JSON configs", () => {
    expect(existsSync(join(repositoryRoot, ".oxlintrc.json"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "knip.json"))).toBe(false);
    expect(existsSync(join(repositoryRoot, "knip.jsonc"))).toBe(true);
  });
});
