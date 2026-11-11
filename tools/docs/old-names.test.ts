import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");
const OLD_NAME = new RegExp(["huntline", "HUN-", "forge", "andryore-starter"].join("|"), "i");
const ALLOWLIST: readonly (string | RegExp)[] = [
  /^docs\/adr\//,
  "CHANGELOG.md",
  /^docs\/brand\/(naming-.*|color-research|apply-spec)\.md$/,
  "src/core/env.test.ts",
  "src/core/doctor.test.ts",
  "src/e2e/docs.test.ts",
  "tools/shim.test.ts",
  "tools/docs/old-names.test.ts",
];

function isAllowed(file: string): boolean {
  return ALLOWLIST.some((entry) => (typeof entry === "string" ? entry === file : entry.test(file)));
}

function trackedFiles(): string[] {
  const result = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: REPO_ROOT });
  return new TextDecoder().decode(result.stdout).split("\0").filter(Boolean);
}

function isBinary(content: Buffer): boolean {
  return content.subarray(0, 8000).includes(0);
}

describe("old names", () => {
  test("no tracked file outside the allowlist names huntline, HUN-, forge or andryore-starter", () => {
    const offenders: string[] = [];
    for (const file of trackedFiles()) {
      if (isAllowed(file)) continue;
      let content: Buffer;
      try {
        content = readFileSync(path.join(REPO_ROOT, file));
      } catch {
        continue;
      }
      if (isBinary(content)) continue;
      if (OLD_NAME.test(content.toString("utf8"))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
