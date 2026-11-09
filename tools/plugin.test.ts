import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dir, "..");

function readJson(relative: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path.join(root, relative), "utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error(`${relative} is not an object`);
  return { ...parsed };
}

describe("plugin manifest", () => {
  test("plugin.json carries the version and marketplace.json lists the plugin", () => {
    const manifest = readJson(".claude-plugin/plugin.json");
    expect(manifest["name"]).toBe("huntline");
    expect(manifest["version"]).toMatch(/^\d+\.\d+\.\d+/);
    const marketplace = readJson(".claude-plugin/marketplace.json");
    expect(JSON.stringify(marketplace["plugins"])).toContain('"name":"huntline"');
    expect(JSON.stringify(marketplace)).not.toContain("version");
  });

  test("the shim exists and is executable", () => {
    expect(statSync(path.join(root, "bin/huntline")).mode & 0o111).not.toBe(0);
  });

  test("init and doctor commands wrap the CLI", () => {
    for (const name of ["init", "doctor"]) {
      const body = readFileSync(path.join(root, "commands", `${name}.md`), "utf8");
      expect(body.startsWith("---\ndescription: ")).toBe(true);
      expect(body).toContain(`huntline ${name}`);
    }
  });
});

describe("repo tooling", () => {
  test("selfCheck runs check and test", () => {
    const config = readJson("emet.config.json");
    expect(JSON.stringify(config["commands"])).toContain('"selfCheck":["bun run check","bun test"]');
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
      expect(release).toContain(`huntline-${target}`);
    }
  });

  test("every template named by init exists", () => {
    for (const name of [
      "huntline.json.tmpl",
      "profile.yaml",
      "facts.yaml",
      "bullets.yaml",
      "never-claim.yaml",
    ]) {
      expect(existsSync(path.join(root, "templates", name))).toBe(true);
    }
  });
});
