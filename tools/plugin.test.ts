import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dir, "..");

function readJson(relative: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path.join(root, relative), "utf8"));
  if (typeof parsed !== "object" || parsed === null)
    throw new Error(`${relative} is not an object`);
  return { ...parsed };
}

describe("plugin manifest", () => {
  test("plugin.json carries the version and marketplace.json lists the plugin", () => {
    const manifest = readJson(".claude-plugin/plugin.json");
    expect(manifest["name"]).toBe("jobship");
    expect(manifest["version"]).toMatch(/^\d+\.\d+\.\d+/);
    const marketplace = readJson(".claude-plugin/marketplace.json");
    expect(JSON.stringify(marketplace["plugins"])).toContain('"name":"jobship"');
    expect(JSON.stringify(marketplace)).not.toContain("version");
  });

  test("the launcher exists and is executable", () => {
    expect(statSync(path.join(root, "bin/jobship")).mode & 0o111).not.toBe(0);
  });

  test("init and doctor commands wrap the CLI", () => {
    for (const name of ["init", "doctor"]) {
      const body = readFileSync(path.join(root, "commands", `${name}.md`), "utf8");
      expect(body.startsWith("---\ndescription: ")).toBe(true);
      expect(body).toContain(`jobship ${name}`);
    }
  });
});

describe("repo tooling", () => {
  test("selfCheck runs check and test", () => {
    const config = readJson("emet.config.json");
    expect(JSON.stringify(config["commands"])).toContain(
      '"selfCheck":["bun run check","bun run test"]',
    );
  });

  test("the check script runs typecheck and lint", () => {
    const scripts = readJson("package.json")["scripts"];
    expect(JSON.stringify(scripts)).toContain("bun run typecheck && bun run lint");
  });

  test("tsconfig enables the required strict flags", () => {
    const options = readJson("tsconfig.json")["compilerOptions"];
    for (const flag of [
      "strict",
      "noUncheckedIndexedAccess",
      "exactOptionalPropertyTypes",
      "verbatimModuleSyntax",
    ]) {
      expect(JSON.stringify(options)).toContain(`"${flag}":true`);
    }
  });

  test("CI runs check and test, and release verifies the tag against plugin.json", () => {
    const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("run: bun run check");
    expect(ci).toContain("run: bun test");
    const release = readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
    expect(release).toContain("SHA256SUMS");
    expect(release).toContain(".claude-plugin/plugin.json");
    for (const target of ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"]) {
      expect(release).toContain(`jobship-${target}`);
    }
  });

  test("every template named by init exists", () => {
    for (const name of [
      "jobship.json.tmpl",
      "profile.yaml",
      "facts.yaml",
      "bullets.yaml",
      "never-claim.yaml",
    ]) {
      expect(existsSync(path.join(root, "templates", name))).toBe(true);
    }
  });
});

function copyLine(heading: string): string {
  const copy = readFileSync(path.join(root, "docs/brand/copy.md"), "utf8");
  const match = new RegExp(`^## ${heading}\\n\\n\`\`\`text\\n([^\\n]+)\\n\`\`\``, "m").exec(copy);
  if (match?.[1] === undefined) throw new Error(`docs/brand/copy.md has no "${heading}" block`);
  return match[1];
}

describe("brand copy on the manifests", () => {
  test("package.json description equals the copy.md package description", () => {
    expect(readJson("package.json")["description"], "package.json description").toBe(
      copyLine("package description"),
    );
  });

  test("package.json author is the org and keywords include jobship", () => {
    const manifest = readJson("package.json");
    expect(manifest["author"], "package.json author").toBe("andryorelabs");
    expect(JSON.stringify(manifest["keywords"]), "package.json keywords").toContain('"jobship"');
  });

  test("plugin.json description equals the copy.md plugin description", () => {
    expect(readJson(".claude-plugin/plugin.json")["description"], "plugin.json description").toBe(
      copyLine("plugin description"),
    );
  });

  test("marketplace.json descriptions equal the plugin description and the owner is the org", () => {
    const marketplace = readJson(".claude-plugin/marketplace.json");
    const line = copyLine("plugin description");
    expect(marketplace["owner"], "marketplace.json owner").toEqual({ name: "andryorelabs" });
    expect(JSON.stringify(marketplace["plugins"]), "marketplace.json plugin description").toContain(
      JSON.stringify(line),
    );
    expect(JSON.stringify(marketplace["metadata"]), "marketplace.json metadata").toContain(
      JSON.stringify(line),
    );
  });
});
