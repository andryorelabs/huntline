import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { compareSettings } from "./compare.ts";
import { readExpectedSettings } from "./check.ts";
import { readLiveSettings } from "./live.ts";
import type { GhApi, GhResult } from "./live.ts";

const FIXTURES = path.join(import.meta.dir, "fixtures");
const RULESET_FILES = path.join(import.meta.dir, "..", "..", ".github", "rulesets");
const BASE = "repos/andryorelabs/jobship";

/** Reads a recorded `gh api` payload. */
function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

/** A successful call. */
function ok(stdout: string): GhResult {
  return { ok: true, stdout, stderr: "" };
}

/** Wraps a ruleset file the way the live API returns it, with volatile fields added. */
function liveRuleset(id: number, name: string): string {
  const source = readFileSync(path.join(RULESET_FILES, `${name}.json`), "utf8");
  return JSON.stringify({
    ...JSON.parse(source),
    id,
    source_type: "Repository",
    updated_at: "2026-01-01",
  });
}

/** A fake `gh api` serving the recorded fixtures, with per-endpoint overrides. */
function fakeGh(overrides: Record<string, GhResult> = {}): GhApi {
  const responses: Record<string, GhResult> = {
    [BASE]: ok(fixture("repo.json")),
    [`${BASE}/vulnerability-alerts`]: ok(""),
    [`${BASE}/private-vulnerability-reporting`]: ok('{"enabled":true}'),
    [`${BASE}/rulesets`]: ok(
      JSON.stringify([
        { id: 1, name: "main" },
        { id: 2, name: "tags" },
        { id: 3, name: "develop" },
      ]),
    ),
    [`${BASE}/rulesets/1`]: ok(liveRuleset(1, "main")),
    [`${BASE}/rulesets/2`]: ok(liveRuleset(2, "tags")),
    [`${BASE}/rulesets/3`]: ok(liveRuleset(3, "develop")),
    ...overrides,
  };
  return (endpoint) => responses[endpoint] ?? { ok: false, stdout: "", stderr: "HTTP 404" };
}

describe("readLiveSettings", () => {
  test("recorded live state matches the files", () => {
    const live = readLiveSettings(fakeGh(), "andryorelabs/jobship");
    expect(compareSettings(readExpectedSettings(), live)).toEqual([]);
  });

  test("treats a 404 from vulnerability-alerts as Dependabot alerts off", () => {
    const gh = fakeGh({
      [`${BASE}/vulnerability-alerts`]: {
        ok: false,
        stdout: "",
        stderr: "gh: Not Found (HTTP 404)",
      },
    });
    const live = readLiveSettings(gh, "andryorelabs/jobship");
    expect(compareSettings(readExpectedSettings(), live)).toEqual([
      { path: "repository.dependabot_alerts", expected: true, live: false },
    ]);
  });

  test("reads a missing security feature as disabled", () => {
    const live = readLiveSettings(
      fakeGh({ [BASE]: ok(fixture("repo-without-security.json")) }),
      "andryorelabs/jobship",
    );
    expect(live.repository.homepage).toBe("");
    expect(live.repository.secret_scanning).toBe("disabled");
    expect(live.repository.dependabot_security_updates).toBe("disabled");
  });

  test("throws when a call fails for a reason other than 404", () => {
    const gh = fakeGh({
      [`${BASE}/vulnerability-alerts`]: { ok: false, stdout: "", stderr: "HTTP 500" },
    });
    expect(() => readLiveSettings(gh, "andryorelabs/jobship")).toThrow("vulnerability-alerts");
  });

  test("throws when private-vulnerability-reporting answers 403", () => {
    const gh = fakeGh({
      [`${BASE}/private-vulnerability-reporting`]: {
        ok: false,
        stdout: "",
        stderr: "gh: Resource not accessible (HTTP 403)",
      },
    });
    expect(() => readLiveSettings(gh, "andryorelabs/jobship")).toThrow(
      "private-vulnerability-reporting",
    );
  });

  test("throws when the repository payload is not JSON", () => {
    expect(() =>
      readLiveSettings(fakeGh({ [BASE]: ok("not json") }), "andryorelabs/jobship"),
    ).toThrow("did not return JSON");
  });
});
