import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractChangelogSection } from "./changelog-section.ts";

const REPO_ROOT = path.join(import.meta.dir, "..", "..");
const SCRIPT = path.join(import.meta.dir, "changelog-section.ts");

const SAMPLE = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "## [1.2.0] - 2026-01-02",
  "",
  "### Added",
  "",
  "- A second thing.",
  "",
  "## [1.2.0-rc.1] - 2026-01-01",
  "",
  "- A release candidate.",
  "",
  "## [1.1.0] - 2025-12-01",
  "",
  "## [1.0.0] - 2025-11-01",
  "",
  "### Fixed",
  "",
  "- The first thing.",
  "",
  "[Unreleased]: https://example.test/compare/v1.2.0...HEAD",
  "[1.2.0]: https://example.test/compare/v1.1.0...v1.2.0",
  "",
].join("\n");

/** Runs the notes script as the release workflow does, from the repository root. */
function runScript(args: readonly string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["bun", SCRIPT, ...args], { cwd: REPO_ROOT });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe("extractChangelogSection", () => {
  test("returns the body of the tag's section without its heading", () => {
    expect(extractChangelogSection(SAMPLE, "v1.2.0")).toBe("### Added\n\n- A second thing.");
  });

  test("accepts a tag without the v prefix", () => {
    expect(extractChangelogSection(SAMPLE, "1.2.0")).toBe("### Added\n\n- A second thing.");
  });

  test("matches the whole version, so a release does not take its candidate's notes", () => {
    expect(extractChangelogSection(SAMPLE, "v1.2.0-rc.1")).toBe("- A release candidate.");
  });

  test("stops the last section at the link references", () => {
    expect(extractChangelogSection(SAMPLE, "v1.0.0")).toBe("### Fixed\n\n- The first thing.");
  });

  test("throws when the changelog has no section for the tag", () => {
    expect(() => extractChangelogSection(SAMPLE, "v9.9.9")).toThrow("no section for v9.9.9");
  });

  test("throws when the section is empty", () => {
    expect(() => extractChangelogSection(SAMPLE, "v1.1.0")).toThrow("is empty");
  });

  test("never returns the Unreleased section for a tag", () => {
    expect(() => extractChangelogSection(SAMPLE, "Unreleased")).toThrow("no section");
    expect(() => extractChangelogSection(SAMPLE, "v")).toThrow("no section");
  });
});

describe("bun tools/release/changelog-section.ts <tag>", () => {
  const changelog = readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8");
  const releasedVersion = /^## \[(\d+\.\d+\.\d+)\]/m.exec(changelog)?.[1] ?? "";

  test("prints exactly the section of a released tag", () => {
    const { exitCode, stdout } = runScript([`v${releasedVersion}`]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(`${extractChangelogSection(changelog, releasedVersion)}\n`);
  });

  test("exits non-zero and prints nothing to stdout for a tag without a section", () => {
    const { exitCode, stdout, stderr } = runScript(["v999.0.0"]);
    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("no section for v999.0.0");
  });

  test("exits non-zero without a tag argument", () => {
    const { exitCode, stdout, stderr } = runScript([]);
    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("Usage");
  });
});
