import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { listMarkdownFiles } from "../lint-docs.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");
const UNINDEXED_PREFIXES = ["docs/agents/", "docs/adr/", "docs/brand/"];
const ENV_VARIABLE = /JOBSHIP_[A-Z][A-Z0-9_]*/g;
const ENV_SUFFIX_CALL = /(?:readSetting|settingValue)\(\s*\w+,\s*"([A-Z][A-Z0-9_]*)"/g;

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

function relativeToRoot(file: string): string {
  return path.relative(REPO_ROOT, file).split(path.sep).join("/");
}

function listSourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...listSourceFiles(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) found.push(full);
  }
  return found;
}

describe("docs set", () => {
  for (const name of ["architecture", "development", "security", "configuration"]) {
    test(`docs/${name}.md exists`, () => {
      expect(existsSync(path.join(DOCS_ROOT, `${name}.md`))).toBe(true);
    });
  }

  test("every Markdown file under docs/ is linked from docs/README.md", () => {
    const index = read("docs/README.md");
    const unlinked = listMarkdownFiles(DOCS_ROOT)
      .map(relativeToRoot)
      .filter((file) => file !== "docs/README.md")
      .filter((file) => !UNINDEXED_PREFIXES.some((prefix) => file.startsWith(prefix)))
      .filter((file) => !index.includes(`(${file.slice("docs/".length)})`));
    expect(unlinked).toEqual([]);
  });

  test("docs/development.md has the repository settings and releasing anchors", () => {
    const development = read("docs/development.md");
    expect(development).toMatch(/^## Repository settings$/m);
    expect(development).toMatch(/^## Releasing$/m);
  });
});

describe("docs/configuration.md", () => {
  const configuration = read("docs/configuration.md");

  test("names every JOBSHIP_ variable that src/ reads", () => {
    const names = new Set<string>();
    for (const file of listSourceFiles(path.join(REPO_ROOT, "src"))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(ENV_VARIABLE)) names.add(match[0]);
      for (const match of text.matchAll(ENV_SUFFIX_CALL)) names.add(`JOBSHIP_${match[1]}`);
    }
    names.delete("JOBSHIP_");
    const missing = [...names].filter((name) => !configuration.includes(name));
    expect(missing).toEqual([]);
  });

  test("names the four standard variables", () => {
    for (const name of [
      "JOBSHIP_HOME",
      "JOBSHIP_CACHE_DIR",
      "JOBSHIP_CLAUDE_PLUGINS_FILE",
      "JOBSHIP_BUILD_VERSION",
    ]) {
      expect(configuration).toContain(name);
    }
  });
});
