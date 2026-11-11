import { expect, test } from "bun:test";
import { join } from "node:path";
import { readRootManifest, repositoryRoot, stringEntriesOf } from "./package-manifest.ts";

const typescript7CompilerBin = join(repositoryRoot, "node_modules", "typescript7", "bin", "tsc");

test("the typescript7 alias bin is TypeScript 7", async () => {
  const versionProcess = Bun.spawn([process.execPath, typescript7CompilerBin, "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const versionOutput = await new Response(versionProcess.stdout).text();
  expect(await versionProcess.exited).toBe(0);
  expect(versionOutput.trim()).toStartWith("Version 7.");
});

test("the typescript7 alias is pinned to an exact TypeScript 7 version", async () => {
  const devDependencies = stringEntriesOf(await readRootManifest(), "devDependencies");
  expect(devDependencies.get("typescript7")).toMatch(/^npm:typescript@7\.\d+\.\d+(-[\w.]+)?$/);
});

test("the typecheck script calls the typescript7 bin by path", async () => {
  const scripts = stringEntriesOf(await readRootManifest(), "scripts");
  expect(scripts.get("typecheck")).toBe(
    "node_modules/typescript7/bin/tsc --noEmit -p tsconfig.json",
  );
  for (const scriptCommand of scripts.values()) {
    expect(scriptCommand).not.toMatch(/(^|[\s&|;])tsc(\s|$)/);
  }
});
