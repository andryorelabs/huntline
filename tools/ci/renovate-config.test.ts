import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.join(import.meta.dir, "..", "..");

/** The labels Renovate may apply; both are declared in `.github/labels.yml`. */
const RENOVATE_LABELS = new Set(["dependencies", "github-actions"]);

/** Exact-pin groups and their members. A group here is never automerged. */
const PIN_GROUPS: Record<string, string[]> = {
  oxc: ["oxlint", "oxlint-tsgolint", "oxfmt", "@oxlint/plugins"],
  typescript7: ["typescript7"],
};

interface PackageRule {
  readonly groupName?: string;
  readonly matchDepNames?: readonly string[];
  readonly matchManagers?: readonly string[];
  readonly rangeStrategy?: string;
  readonly automerge?: boolean;
  readonly minimumReleaseAge?: string;
  readonly labels?: readonly string[];
  readonly addLabels?: readonly string[];
}

interface CustomManager {
  readonly customType?: string;
  readonly managerFilePatterns?: readonly string[];
  readonly matchStrings?: readonly string[];
  readonly depNameTemplate?: string;
  readonly datasourceTemplate?: string;
}

interface RenovateConfig {
  readonly extends?: readonly string[];
  readonly schedule?: readonly string[];
  readonly rangeStrategy?: string;
  readonly minimumReleaseAge?: string;
  readonly dependencyDashboard?: boolean;
  readonly labels?: readonly string[];
  readonly vulnerabilityAlerts?: { readonly labels?: readonly string[] };
  readonly lockFileMaintenance?: { readonly schedule?: readonly string[] };
  readonly customManagers?: readonly CustomManager[];
  readonly packageRules: readonly PackageRule[];
}

/** Whether `value` is a parsed Renovate config with a `packageRules` list. */
function isRenovateConfig(value: unknown): value is RenovateConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "packageRules" in value &&
    Array.isArray(value.packageRules)
  );
}

/** Parses Renovate config text, failing when it has no `packageRules` list. */
function parseRenovateConfig(text: string): RenovateConfig {
  const parsed: unknown = Bun.JSON5.parse(text);
  if (!isRenovateConfig(parsed)) {
    throw new Error("renovate.json5 has no packageRules list");
  }
  return parsed;
}

/** Names of the exact-pin groups that are missing, loosely pinned or automerged. */
function brokenPinGroups(config: RenovateConfig): string[] {
  return Object.entries(PIN_GROUPS)
    .filter(([groupName, members]) => {
      const rule = config.packageRules.find((candidate) => candidate.groupName === groupName);
      return (
        rule === undefined ||
        rule.automerge !== false ||
        rule.rangeStrategy !== "pin" ||
        JSON.stringify(rule.matchDepNames) !== JSON.stringify(members)
      );
    })
    .map(([groupName]) => groupName);
}

/** Every schedule entry of the config that does not run on Monday. */
function nonMondaySchedules(config: RenovateConfig): string[] {
  const schedules = [config.schedule, config.lockFileMaintenance?.schedule];
  if (config.schedule === undefined || config.schedule.length === 0) {
    return ["<no top-level schedule>"];
  }
  return schedules
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !/\bon monday$/.test(entry));
}

/** Every label the config can apply, from any block. */
function appliedLabels(config: RenovateConfig): string[] {
  return [
    ...(config.labels ?? []),
    ...(config.vulnerabilityAlerts?.labels ?? []),
    ...config.packageRules.flatMap((rule) => [...(rule.labels ?? []), ...(rule.addLabels ?? [])]),
  ];
}

const configText = readFileSync(path.join(REPO_ROOT, "renovate.json5"), "utf8");
const config = parseRenovateConfig(configText);

describe("renovate policy rules", () => {
  test("flag a pin group with automerge: true", () => {
    const automerged = parseRenovateConfig(
      configText.replace(
        /(groupName: "oxc",[^}]*?)automerge: false/,
        (_, before: string) => `${before}automerge: true`,
      ),
    );
    expect(brokenPinGroups(automerged)).toEqual(["oxc"]);
  });

  test("flag a missing pin group", () => {
    const withoutGroup = parseRenovateConfig(
      configText.replace('groupName: "typescript7"', 'groupName: "renamed"'),
    );
    expect(brokenPinGroups(withoutGroup)).toEqual(["typescript7"]);
  });

  test("flag a schedule that is not Monday", () => {
    const tuesday = parseRenovateConfig(configText.replace("on monday", "on tuesday"));
    const unscheduled = parseRenovateConfig("{ packageRules: [] }");
    expect(nonMondaySchedules(tuesday)).toEqual(["before 12pm on tuesday"]);
    expect(nonMondaySchedules(unscheduled)).toHaveLength(1);
  });

  test("reject a config without packageRules", () => {
    expect(() => parseRenovateConfig("{ extends: [] }")).toThrow("no packageRules");
  });
});

describe("renovate.json5", () => {
  test("extends config:best-practices and keeps the dependency dashboard", () => {
    expect(config.extends).toContain("config:best-practices");
    expect(
      config.dependencyDashboard === true || config.extends?.includes(":dependencyDashboard"),
    ).toBe(true);
  });

  test("bumps ranges and waits three days", () => {
    expect(config.rangeStrategy).toBe("bump");
    expect(config.minimumReleaseAge).toBe("3 days");
  });

  test("runs on Monday only", () => {
    expect(nonMondaySchedules(config)).toEqual([]);
  });

  test("labels every pull request dependencies and GitHub Actions ones github-actions", () => {
    const actionsRule = config.packageRules.find(
      (rule) => rule.matchManagers?.includes("github-actions") && rule.addLabels !== undefined,
    );
    expect(config.labels).toEqual(["dependencies"]);
    expect(actionsRule?.addLabels).toEqual(["github-actions"]);
  });

  test("applies no label outside dependencies and github-actions", () => {
    expect(appliedLabels(config).filter((label) => !RENOVATE_LABELS.has(label))).toEqual([]);
  });

  test("every automerged rule waits seven days", () => {
    const automerged = config.packageRules.filter((rule) => rule.automerge === true);
    expect(automerged.length).toBeGreaterThan(0);
    expect(automerged.filter((rule) => rule.minimumReleaseAge !== "7 days")).toEqual([]);
  });

  test("pins the oxc and typescript7 groups exactly and never automerges them", () => {
    expect(brokenPinGroups(config)).toEqual([]);
  });

  test("declares the pin groups after every automerge rule so they win", () => {
    const lastAutomerge = config.packageRules.findLastIndex((rule) => rule.automerge === true);
    const pinPositions = Object.keys(PIN_GROUPS).map((groupName) =>
      config.packageRules.findIndex((rule) => rule.groupName === groupName),
    );
    expect(Math.min(...pinPositions)).toBeGreaterThan(lastAutomerge);
  });
});

describe("renovate custom managers", () => {
  const lintWorkflows = readFileSync(
    path.join(REPO_ROOT, ".github", "workflows", "lint-workflows.yml"),
    "utf8",
  );

  test.each(["rhysd/actionlint", "zizmorcore/zizmor"])(
    "%s has a regex manager that finds its version in lint-workflows.yml",
    (depName) => {
      const manager = config.customManagers?.find(
        (candidate) => candidate.depNameTemplate === depName,
      );
      const filePattern = (manager?.managerFilePatterns?.[0] ?? "").replace(/^\/|\/$/g, "");
      const versions = (manager?.matchStrings ?? []).map(
        (pattern) => new RegExp(pattern).exec(lintWorkflows)?.groups?.["currentValue"],
      );
      expect(manager?.customType).toBe("regex");
      expect(manager?.datasourceTemplate).toBe("github-releases");
      expect(new RegExp(filePattern).test(".github/workflows/lint-workflows.yml")).toBe(true);
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatch(/^v?\d+\.\d+\.\d+$/);
    },
  );
});
