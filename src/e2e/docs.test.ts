import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { COMMANDS } from "../core/commands.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

function documentedCommands(markdown: string): Set<string> {
  const names = new Set<string>();
  for (const match of markdown.matchAll(/^### `jobship ([a-z ]+)`$/gm)) {
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

describe("onboarding docs", () => {
  const install = read("docs/guide/install.md");
  const prose = [
    "README.md",
    "docs/guide/install.md",
    "docs/guide/dogfooding.md",
    "docs/guide/adopting.md",
    "docs/reference/cli.md",
    "docs/reference/profile.md",
    "docs/troubleshooting.md",
    "skills/browser-source/SKILL.md",
    "skills/sweep/SKILL.md",
    "schema/profile.schema.json",
  ];

  test("uses the andryorelabs repo URL and drops the old browser server name", () => {
    for (const file of prose) {
      const text = read(file);
      expect(text).not.toContain(["Andry", "Ore/huntline"].join(""));
      expect(text).not.toContain(["user", "chrome"].join("-"));
    }
  });

  test("documents poppler for apt, brew, dnf and pacman", () => {
    for (const command of [
      "apt install poppler-utils",
      "brew install poppler",
      "dnf install poppler-utils",
      "pacman -S poppler",
    ]) {
      expect(install).toContain(command);
    }
  });

  test("lists every valid Source name and company add", () => {
    for (const name of [
      "greenhouse",
      "lever",
      "ashby",
      "workable",
      "smartrecruiters",
      "getonboard",
      "himalayas",
      "remoteok",
      "hn",
    ]) {
      expect(install).toContain(`\`${name}\``);
    }
    expect(install).toContain("jobship company add");
  });

  test("documents browser MCP setup, status --set and --help", () => {
    expect(install).toContain("--remote-debugging-port=9222");
    expect(install).toContain("mcpServers");
    expect(install).toContain("status <key> --set <state>");
    expect(install).toContain("--help");
  });

  test("warns about terms of service in the guide and the browser-source skill", () => {
    expect(install).toContain("terms of service");
    expect(read("skills/browser-source/SKILL.md")).toContain("terms of service");
  });

  test("describes migrate legacy as a single-format importer", () => {
    expect(read("docs/reference/cli.md")).toContain("one specific legacy Markdown format");
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

  test("starts with Install, before Quickstart, with the marketplace commands", () => {
    expect(readme.indexOf("## Install")).toBeGreaterThan(-1);
    expect(readme.indexOf("## Install")).toBeLessThan(readme.indexOf("## Quickstart"));
    expect(readme).toContain("claude plugin marketplace add andryorelabs/jobship");
    expect(readme).toContain("claude plugin install jobship@jobship-marketplace");
    expect(readme).toContain("/jobship:init");
    expect(readme).toContain("/jobship:doctor");
    expect(readme).toContain("Windows is unsupported");
  });

  test("drops the construction notice and working name", () => {
    expect(readme).not.toContain("under construction");
    expect(readme).not.toContain("Working name");
  });

  test("links to the guides and references that exist", () => {
    for (const match of readme.matchAll(/\]\((docs\/[^)]+|GLOSSARY\.md)\)/g)) {
      expect(() => read((match[1] ?? "").split("#")[0] ?? "")).not.toThrow();
    }
  });
});

function copyLine(heading: string): string {
  const match = new RegExp(`^## ${heading}\\n\\n\`\`\`text\\n([^\\n]+)\\n\`\`\``, "m").exec(
    read("docs/brand/copy.md"),
  );
  if (match?.[1] === undefined) throw new Error(`docs/brand/copy.md has no "${heading}" block`);
  return match[1];
}

describe("README brand kit", () => {
  const readme = read("README.md");

  test("README.md opens with a picture switching both covers by color scheme", () => {
    expect(readme, "README.md picture").toContain("<picture>");
    expect(readme, "README.md dark cover").toContain("docs/brand/og/cover.png");
    expect(readme, "README.md light cover").toContain("docs/brand/og/cover-light.png");
    expect(readme, "README.md color scheme").toContain("prefers-color-scheme");
    expect(readme.indexOf("<picture>"), "README.md picture position").toBeLessThan(
      readme.indexOf("[![CI]"),
    );
    for (const cover of ["cover.png", "cover-light.png"]) {
      expect(existsSync(path.join(REPO_ROOT, "docs/brand/og", cover)), cover).toBe(true);
    }
  });

  test("README.md carries the brand line, plain line and non-affiliation notice", () => {
    for (const heading of ["brand line", "plain line", "non-affiliation notice"]) {
      expect(readme, `README.md ${heading}`).toContain(copyLine(heading));
    }
  });

  test("README.md no longer carries the old intro sentence", () => {
    expect(readme, "README.md intro").not.toContain("a plugin plus a CLI that sweeps job sources");
  });
});
