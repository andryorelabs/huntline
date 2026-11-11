import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { isRecord, readRootManifest, repositoryRoot, stringEntriesOf } from "./package-manifest.ts";

/**
 * Returns the fenced text block under one `## <heading>` of `docs/brand/copy.md`.
 */
async function brandCopyLine(heading: string): Promise<string> {
  const copy = await Bun.file(join(repositoryRoot, "docs", "brand", "copy.md")).text();
  const section = copy.split(`## ${heading}\n`)[1] ?? "";
  const line = section.split("```text\n")[1]?.split("\n```")[0];
  if (line === undefined) {
    throw new Error(`docs/brand/copy.md has no "${heading}" block`);
  }
  return line;
}

describe("package.json metadata", () => {
  test("carries the package description from the brand copy", async () => {
    const manifest = await readRootManifest();
    expect(manifest["description"]).toBe(await brandCopyLine("package description"));
  });

  test("names the license and the author", async () => {
    const manifest = await readRootManifest();
    expect(manifest["license"]).toBe("MIT");
    expect(manifest["author"]).toBe("Andry Orellana <hello@andryore.dev>");
  });

  test("points homepage, repository and bugs at github.com/andryorelabs/jobship", async () => {
    const manifest = await readRootManifest();
    expect(manifest["homepage"]).toBe("https://github.com/andryorelabs/jobship#readme");
    expect(manifest["repository"]).toEqual({
      type: "git",
      url: "git+https://github.com/andryorelabs/jobship.git",
    });
    const bugs = manifest["bugs"];
    expect(isRecord(bugs) ? bugs["url"] : undefined).toBe(
      "https://github.com/andryorelabs/jobship/issues",
    );
  });
});

describe("package.json scripts", () => {
  test.each([
    [
      "check",
      "bun run typecheck && bun run lint && bun run format:check && bun run knip && bun run lint:docs",
    ],
    ["typecheck", "node_modules/typescript7/bin/tsc --noEmit -p tsconfig.json"],
    ["format:write", "oxfmt"],
    ["format:check", "oxfmt --check"],
    ["fix", "bun run format:write && bun run lint --fix"],
    ["lint:docs", "bun tools/lint-docs.ts"],
    ["lint:commits", "bun x --no-install commitlint --from origin/main --to HEAD"],
    ["repo-settings:check", "bun tools/repo-settings/check.ts"],
  ])("%s runs %s", async (scriptName, scriptCommand) => {
    const scripts = stringEntriesOf(await readRootManifest(), "scripts");
    expect(scripts.get(scriptName)).toBe(scriptCommand);
  });

  test("format:write replaces format", async () => {
    const scripts = stringEntriesOf(await readRootManifest(), "scripts");
    expect(scripts.has("format")).toBe(false);
  });

  test("test and lint exist", async () => {
    const scripts = stringEntriesOf(await readRootManifest(), "scripts");
    expect(scripts.get("test")).toStartWith("bun ");
    expect(scripts.get("lint")).toStartWith("oxlint");
  });

  test("ci:local lints the commits through the lint:commits script", async () => {
    const ciLocal = stringEntriesOf(await readRootManifest(), "scripts").get("ci:local") ?? "";
    expect(ciLocal.split(" && ")).toContain("bun run lint:commits");
    expect(ciLocal.split(" && ")).toContain("bun run check");
    expect(ciLocal).not.toContain("commitlint");
  });
});

describe("exact pins", () => {
  test.each(["oxlint", "oxlint-tsgolint", "oxfmt", "@oxlint/plugins"])(
    "%s is pinned to an exact version",
    async (dependencyName) => {
      const devDependencies = stringEntriesOf(await readRootManifest(), "devDependencies");
      expect(devDependencies.get(dependencyName)).toMatch(/^\d+\.\d+\.\d+$/);
    },
  );

  test("the oxlint plugin API matches the oxlint version", async () => {
    const devDependencies = stringEntriesOf(await readRootManifest(), "devDependencies");
    expect(devDependencies.get("@oxlint/plugins")).toBe(devDependencies.get("oxlint"));
  });
});
