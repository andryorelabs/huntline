import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.join(import.meta.dir, "..", "..");
const GITHUB_DIRECTORY = path.join(REPO_ROOT, ".github");
const FORMS_DIRECTORY = path.join(GITHUB_DIRECTORY, "ISSUE_TEMPLATE");

const REQUIRED_LABELS = [
  "Type: Bug",
  "Type: Feature",
  "Type: Enhancement",
  "Type: Docs",
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
  "status:todo",
  "status:in-progress",
  "status:in-review",
  "dependencies",
  "github-actions",
  "breaking-change",
];

const FORM_FILES = [
  "1-bug-report.yml",
  "2-feature-request.yml",
  "3-enhancement-request.yml",
  "4-documentation-bug.yml",
];

/** Reads a UTF-8 file under `.github`. */
function readGithubFile(relativePath: string): string {
  return readFileSync(path.join(GITHUB_DIRECTORY, relativePath), "utf8");
}

/** Whether `value` is a non-null object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every label name declared in `.github/labels.yml`. */
function declaredLabels(): string[] {
  const parsed: unknown = Bun.YAML.parse(readGithubFile("labels.yml"));
  if (!Array.isArray(parsed)) throw new Error("labels.yml must be a list");
  return (parsed as unknown[]).map((entry) => {
    const name = isRecord(entry) ? entry["name"] : undefined;
    if (typeof name !== "string") throw new Error("every labels.yml entry needs a string name");
    return name;
  });
}

/** The labels an issue form applies. */
function formLabels(file: string): string[] {
  const parsed: unknown = Bun.YAML.parse(readGithubFile(`ISSUE_TEMPLATE/${file}`));
  const labels = isRecord(parsed) ? parsed["labels"] : undefined;
  if (!Array.isArray(labels)) throw new Error(`${file} applies no labels`);
  return (labels as unknown[]).map(String);
}

/**
 * The label strings `renovate.json5` names under any `labels` key.
 * Renovate config is JSON5, which Bun parses natively.
 */
function renovateLabels(): string[] {
  const parsed: unknown = Bun.JSON5.parse(
    readFileSync(path.join(REPO_ROOT, "renovate.json5"), "utf8"),
  );
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value as unknown[]) visit(item);
    } else if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        if ((key === "labels" || key === "addLabels") && Array.isArray(child)) {
          found.push(...(child as unknown[]).map(String));
        } else {
          visit(child);
        }
      }
    }
  };
  visit(parsed);
  return found;
}

/** The labels in `names` that `declared` does not contain. */
function missingFrom(declared: string[], names: string[]): string[] {
  const known = new Set(declared);
  return names.filter((name) => !known.has(name));
}

describe("labels.yml", () => {
  test("has no duplicate names", () => {
    const declared = declaredLabels();
    expect(new Set(declared).size).toBe(declared.length);
  });

  test("declares every required label", () => {
    expect(missingFrom(declaredLabels(), REQUIRED_LABELS)).toEqual([]);
  });

  test("declares the Type, Status, Priority and Area families", () => {
    const declared = declaredLabels();
    for (const family of ["Type: ", "Status: ", "Priority: ", "Area: "]) {
      expect(declared.some((name) => name.startsWith(family))).toBe(true);
    }
  });

  test("every issue form applies only declared labels", () => {
    for (const file of FORM_FILES) {
      expect({ file, missing: missingFrom(declaredLabels(), formLabels(file)) }).toEqual({
        file,
        missing: [],
      });
    }
  });

  test("every label renovate.json5 names is declared", () => {
    const labels = renovateLabels();
    expect(labels).toContain("dependencies");
    expect(missingFrom(declaredLabels(), labels)).toEqual([]);
  });

  test("a label missing from labels.yml is detected", () => {
    expect(missingFrom(["bug"], ["bug", "Type: Nope"])).toEqual(["Type: Nope"]);
  });
});

describe("issue forms", () => {
  test("the directory holds exactly the four forms and config.yml", () => {
    expect(readdirSync(FORMS_DIRECTORY).toSorted()).toEqual(
      [...FORM_FILES, "config.yml"].toSorted(),
    );
  });

  test("config.yml disables blank issues, links the security advisory and not Discussions", () => {
    const parsed: unknown = Bun.YAML.parse(readGithubFile("ISSUE_TEMPLATE/config.yml"));
    if (!isRecord(parsed)) throw new Error("config.yml must be a mapping");
    expect(parsed["blank_issues_enabled"]).toBe(false);
    const links = JSON.stringify(parsed["contact_links"]);
    expect(links).toContain("/security/advisories/new");
    expect(links.toLowerCase()).not.toContain("discussions");
  });
});
