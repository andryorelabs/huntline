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

describe("README anatomy", () => {
  const readme = read("README.md");

  test("the top block is centered and ordered: H1, cover, slogan, badges, links", () => {
    const positions = [
      readme.indexOf('<div align="center">'),
      readme.indexOf("# jobship"),
      readme.indexOf("<picture>"),
      readme.indexOf(`**${copyLine("brand line")}**`),
      readme.indexOf("[![CI]"),
      readme.indexOf("[Install](docs/guide/install.md) ·"),
    ];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
  });

  test("badges are CI, Release, License, OpenSSF Scorecard in that order", () => {
    const badges = [...readme.matchAll(/^\[!\[([^\]]+)\]/gm)].map((match) => match[1]);
    expect(badges).toEqual(["CI", "Release", "License: MIT", "OpenSSF Scorecard"]);
  });

  test("sections follow the standard order", () => {
    const headings = [...readme.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual([
      "What it is",
      "Install",
      "Quickstart",
      "How it works",
      "Safety model",
      "Requirements",
      "Documentation",
      "Contributing",
      "License",
    ]);
  });

  test("the last lines are the credit line then the non-affiliation notice", () => {
    const lines = readme.trimEnd().split("\n");
    expect(lines.slice(-3)).toEqual([
      "Built by [AndryOre](https://andryore.dev)",
      "",
      copyLine("non-affiliation notice"),
    ]);
  });
});

describe("CHANGELOG.md", () => {
  const changelog = read("CHANGELOG.md");
  const repository = "https://github.com/andryorelabs/jobship";

  test("states SemVer and keeps Unreleased", () => {
    expect(changelog).toContain("Semantic Versioning");
    expect(changelog).toContain("## [Unreleased]");
  });

  test("every released section has a link reference", () => {
    const versions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(
      (match) => match[1] ?? "",
    );
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(changelog, `link reference for ${version}`).toMatch(
        new RegExp(`^\\[${version.replaceAll(".", "\\.")}\\]: ${repository}/`, "m"),
      );
    }
    expect(changelog).toMatch(new RegExp(`^\\[Unreleased\\]: ${repository}/compare/`, "m"));
  });
});

describe("GLOSSARY.md and ROADMAP.md", () => {
  test("GLOSSARY.md has Language, Relationships and Flagged ambiguities in order", () => {
    const headings = [...read("GLOSSARY.md").matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual(["Language", "Relationships", "Flagged ambiguities"]);
  });

  test("ROADMAP.md has Now, Next and Later in order", () => {
    const headings = [...read("ROADMAP.md").matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual(["Now", "Next", "Later"]);
  });
});

describe("community files", () => {
  test("the community files exist", () => {
    for (const file of [".github/SUPPORT.md", ".gitattributes", "llms.txt"]) {
      expect(existsSync(path.join(REPO_ROOT, file)), file).toBe(true);
    }
    expect(read(".gitattributes")).toContain("* text=auto eol=lf");
    expect(read(".gitattributes")).toContain("linguist-generated");
  });

  test("the pull request template has its sections and the title format", () => {
    const template = read(".github/PULL_REQUEST_TEMPLATE.md");
    const headings = [...template.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual([
      "Description",
      "Related issue",
      "Type of change",
      "Breaking change",
      "Checklist",
    ]);
    expect(template).toContain("`type: <gitmoji> lowercase subject`");
  });

  test("CONTRIBUTING.md lists one default gitmoji per type", () => {
    const contributing = read("CONTRIBUTING.md");
    const defaults: Record<string, string> = {
      feat: "✨",
      fix: "🐛",
      docs: "📝",
      refactor: "♻️",
      perf: "⚡️",
      test: "✅",
      build: "📦",
      ci: "👷",
      chore: "🔧",
      deps: "⬆️",
      release: "🔖",
      revert: "⏪",
    };
    for (const [type, gitmoji] of Object.entries(defaults)) {
      expect(contributing, type).toContain(`| \`${type}\``);
      expect(contributing, type).toContain(`| ${gitmoji}`);
    }
  });
});

const ABSENCE_TESTS = new Set([
  "src/core/doctor.test.ts",
  "src/core/env.test.ts",
  "src/e2e/docs.test.ts",
  "tools/shim.test.ts",
]);

/** Tests that assert the old name is gone mention it on purpose. */
describe("pre-rename name", () => {
  test("code, templates, skills, commands and hooks no longer mention huntline", () => {
    const result = Bun.spawnSync(
      [
        "git",
        "grep",
        "-il",
        "huntline",
        "--",
        "src",
        "bin",
        "templates",
        "tools",
        "skills",
        "commands",
        "agents",
        "hooks",
      ],
      { cwd: REPO_ROOT },
    );
    const hits = result.stdout
      .toString()
      .split("\n")
      .filter((file) => file !== "" && !ABSENCE_TESTS.has(file));
    expect(hits).toEqual([]);
  });
});
