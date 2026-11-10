import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { COMMANDS } from "../core/commands.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

function documentedCommands(markdown: string): Set<string> {
  const names = new Set<string>();
  for (const match of markdown.matchAll(/^### `huntline ([a-z ]+)`$/gm)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  return names;
}

describe("docs/reference/cli.md", () => {
  const cli = read("docs/reference/cli.md");
  const documented = documentedCommands(cli);

  test("documents every command in COMMANDS plus init and doctor", () => {
    const expected = new Set(["init", "doctor", "setup", ...Object.keys(COMMANDS)]);
    for (const command of expected) expect(documented.has(command)).toBe(true);
  });

  test("documents no command that does not exist", () => {
    const known = new Set(["init", "doctor", "setup", ...Object.keys(COMMANDS)]);
    for (const command of documented) expect(known.has(command)).toBe(true);
  });

  test("lists every exit code", () => {
    for (const code of [0, 1, 2, 3]) expect(cli).toMatch(new RegExp(`^\\| ${code}\\s+\\|`, "m"));
  });
});

describe("README.md", () => {
  const readme = read("README.md");

  test("documents the no-submit rule and the Guard", () => {
    expect(readme).toContain("No-submit rule");
    expect(readme).toContain("never submits a form and never sends a message");
    expect(readme).toContain("The Guard");
  });

  test("documents the Gmail and browser MCP requirements", () => {
    expect(readme).toContain("**Browser MCP.**");
    expect(readme).toContain("**Gmail MCP.**");
  });

  test("links to the guides and references that exist", () => {
    for (const match of readme.matchAll(/\]\((docs\/[^)]+|GLOSSARY\.md)\)/g)) {
      expect(() => read(match[1] ?? "")).not.toThrow();
    }
  });
});
