import { describe, expect, test } from "bun:test";
import { compareSettings, formatDifference } from "./compare.ts";
import type { JsonValue, RepoSettings } from "./compare.ts";
import { readExpectedSettings } from "./check.ts";

type JsonObject = { [key: string]: JsonValue };

/** Whether `value` is a plain JSON object. */
function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A deep copy of the settings kept as code, safe to mutate. */
function freshSettings(): RepoSettings {
  return structuredClone(readExpectedSettings());
}

/** Rewrites the `main` ruleset of `settings` through `change`. */
function changeMain(settings: RepoSettings, change: (main: JsonObject) => JsonObject): void {
  const main = settings.rulesets["main"];
  if (!isObject(main)) {
    throw new Error("missing main ruleset");
  }
  settings.rulesets["main"] = change(main);
}

/** Maps every rule of `main`. */
function mapRules(main: JsonObject, change: (rule: JsonObject) => JsonObject): JsonObject {
  const rules = main["rules"];
  if (!Array.isArray(rules)) {
    throw new Error("main has no rules");
  }
  return { ...main, rules: rules.map((rule) => (isObject(rule) ? change(rule) : rule)) };
}

describe("compareSettings", () => {
  test("reports no difference for identical settings", () => {
    expect(compareSettings(freshSettings(), freshSettings())).toEqual([]);
  });

  test("ignores topic order, rule order and volatile ruleset fields", () => {
    const live = freshSettings();
    live.repository.topics.reverse();
    changeMain(live, (main) => {
      const rules = main["rules"];
      return {
        ...main,
        id: 42,
        source: "andryorelabs/jobship",
        updated_at: "2026-01-01",
        rules: Array.isArray(rules) ? rules.toReversed() : [],
      };
    });
    expect(compareSettings(freshSettings(), live)).toEqual([]);
  });

  test("ignores parameters GitHub adds that the files do not name", () => {
    const live = freshSettings();
    changeMain(live, (main) =>
      mapRules(main, (rule) =>
        isObject(rule["parameters"])
          ? { ...rule, parameters: { ...rule["parameters"], required_reviewers: [] } }
          : rule,
      ),
    );
    expect(compareSettings(freshSettings(), live)).toEqual([]);
  });

  test("reports a drifted repository setting with its path", () => {
    const live = freshSettings();
    live.repository.allow_merge_commit = true;
    expect(compareSettings(freshSettings(), live)).toEqual([
      { path: "repository.allow_merge_commit", expected: false, live: true },
    ]);
  });

  test("reports a changed topic list", () => {
    const live = freshSettings();
    live.repository.topics = ["bun"];
    const paths = compareSettings(freshSettings(), live).map((difference) => difference.path);
    expect(paths).toContain("repository.topics[1]");
  });

  test("reports a changed rule parameter", () => {
    const live = freshSettings();
    changeMain(live, (main) =>
      mapRules(main, (rule) =>
        isObject(rule["parameters"])
          ? {
              ...rule,
              parameters: { ...rule["parameters"], strict_required_status_checks_policy: false },
            }
          : rule,
      ),
    );
    const differences = compareSettings(freshSettings(), live);
    expect(differences.map((difference) => difference.path)).toEqual([
      "rulesets.main.rules[5].parameters.strict_required_status_checks_policy",
    ]);
  });

  test("reports a dropped rule", () => {
    const live = freshSettings();
    changeMain(live, (main) => {
      const rules = main["rules"];
      return {
        ...main,
        rules: Array.isArray(rules)
          ? rules.filter((rule) => !isObject(rule) || rule["type"] !== "required_signatures")
          : [],
      };
    });
    const differences = compareSettings(freshSettings(), live);
    expect(differences.length).toBeGreaterThan(0);
    expect(
      differences.every((difference) => difference.path.startsWith("rulesets.main.rules")),
    ).toBe(true);
  });

  test("reports a missing and an unexpected ruleset", () => {
    const live = freshSettings();
    delete live.rulesets["tags"];
    live.rulesets["extra"] = { name: "extra" };
    const paths = compareSettings(freshSettings(), live).map((difference) => difference.path);
    expect(paths).toEqual(["rulesets.extra", "rulesets.tags"]);
  });

  test("formats a difference on one line", () => {
    expect(
      formatDifference({ path: "repository.has_wiki", expected: false, live: undefined }),
    ).toBe("repository.has_wiki: expected false, live (missing)");
  });
});
