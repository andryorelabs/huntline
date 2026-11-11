import { describe, expect, test } from "bun:test";
import { formatCall, planApply } from "./apply.ts";
import { readExpectedSettings } from "./check.ts";

const REPOSITORY = "andryorelabs/jobship";
const BASE = `repos/${REPOSITORY}`;

describe("planApply", () => {
  const expected = readExpectedSettings();

  test("creates every ruleset when none exists live", () => {
    const calls = planApply(REPOSITORY, expected, []);
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts.map((call) => call.endpoint)).toEqual([
      `${BASE}/rulesets`,
      `${BASE}/rulesets`,
      `${BASE}/rulesets`,
    ]);
  });

  test("updates a ruleset in place when a live one has its name", () => {
    const calls = planApply(REPOSITORY, expected, [{ id: 7, name: "main" }]);
    expect(calls.map((call) => `${call.method} ${call.endpoint}`)).toContain(
      `PUT ${BASE}/rulesets/7`,
    );
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);
  });

  test("turns Dependabot alerts on before the PATCH that sets security updates", () => {
    const calls = planApply(REPOSITORY, expected, []);
    const alerts = calls.findIndex((call) => call.endpoint === `${BASE}/vulnerability-alerts`);
    const patch = calls.findIndex((call) => call.method === "PATCH");
    expect(calls[alerts]?.method).toBe("PUT");
    expect(alerts).toBeLessThan(patch);
  });

  test("uses DELETE when the file turns alerts and private reporting off", () => {
    const off = structuredClone(expected);
    off.repository.dependabot_alerts = false;
    off.repository.private_vulnerability_reporting = false;
    const methods = planApply(REPOSITORY, off, [])
      .filter((call) => call.endpoint.endsWith("-alerts") || call.endpoint.endsWith("-reporting"))
      .map((call) => call.method);
    expect(methods).toEqual(["DELETE", "DELETE"]);
  });

  test("sets topics through PUT topics", () => {
    const topics = planApply(REPOSITORY, expected, []).find(
      (call) => call.endpoint === `${BASE}/topics`,
    );
    expect(topics).toEqual({
      method: "PUT",
      endpoint: `${BASE}/topics`,
      body: { names: expected.repository.topics },
    });
  });

  test("nests the three security features under security_and_analysis", () => {
    const patch = planApply(REPOSITORY, expected, []).find((call) => call.method === "PATCH");
    expect(patch?.endpoint).toBe(BASE);
    expect(patch?.body).toMatchObject({
      allow_squash_merge: true,
      squash_merge_commit_title: "PR_TITLE",
      security_and_analysis: {
        secret_scanning: { status: "enabled" },
        secret_scanning_push_protection: { status: "enabled" },
        dependabot_security_updates: { status: "enabled" },
      },
    });
  });

  test("covers every key the settings file holds", () => {
    const patch = planApply(REPOSITORY, expected, []).find((call) => call.method === "PATCH");
    const sent = JSON.stringify(patch?.body);
    const handledElsewhere = new Set([
      "topics",
      "dependabot_alerts",
      "private_vulnerability_reporting",
      "secret_scanning",
      "secret_scanning_push_protection",
      "dependabot_security_updates",
    ]);
    for (const key of Object.keys(expected.repository)) {
      expect({ key, covered: handledElsewhere.has(key) || sent.includes(`"${key}"`) }).toEqual({
        key,
        covered: true,
      });
    }
  });

  test("never plans a call outside the repository", () => {
    for (const call of planApply(REPOSITORY, expected, [{ id: 1, name: "tags" }])) {
      expect(call.endpoint.startsWith(BASE)).toBe(true);
    }
  });

  test("formats a call on one line", () => {
    expect(formatCall({ method: "DELETE", endpoint: `${BASE}/vulnerability-alerts` })).toBe(
      `DELETE ${BASE}/vulnerability-alerts`,
    );
  });
});
