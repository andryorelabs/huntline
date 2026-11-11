import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { coverageExemptions } from "./coverage-exemptions.ts";
import {
  collectImportedModules,
  findCoverageProblems,
  listSourceModules,
  listTestFiles,
} from "./coverage-manifest.ts";

const repoRoot = resolve(import.meta.dir, "../..");

describe("findCoverageProblems", () => {
  const modules = ["src/a.ts", "src/b.ts"];

  test("accepts imported modules and justified exemptions", () => {
    expect(
      findCoverageProblems({
        modules,
        importedModules: new Set(["src/a.ts"]),
        exemptions: { "src/b.ts": "process entry point" },
      }),
    ).toEqual([]);
  });

  test("flags a module with no test and no exemption", () => {
    expect(
      findCoverageProblems({ modules, importedModules: new Set(["src/a.ts"]), exemptions: {} }),
    ).toEqual(["src/b.ts is not imported by any test and has no exemption"]);
  });

  test("flags an empty reason", () => {
    expect(
      findCoverageProblems({
        modules,
        importedModules: new Set(["src/a.ts"]),
        exemptions: { "src/b.ts": "  " },
      }),
    ).toEqual(["exemption for src/b.ts has an empty reason"]);
  });

  test("flags an exemption for a missing module", () => {
    expect(
      findCoverageProblems({
        modules,
        importedModules: new Set(modules),
        exemptions: { "src/gone.ts": "was an entry point" },
      }),
    ).toEqual(["exemption for src/gone.ts is stale: the module does not exist"]);
  });

  test("flags an exemption for a module a test now imports", () => {
    expect(
      findCoverageProblems({
        modules,
        importedModules: new Set(modules),
        exemptions: { "src/a.ts": "no test" },
      }),
    ).toEqual(["exemption for src/a.ts is stale: a test now imports it"]);
  });
});

describe("repository coverage manifest", () => {
  test("every source module is imported by a test or exempted with a reason", () => {
    const problems = findCoverageProblems({
      modules: listSourceModules(repoRoot),
      importedModules: collectImportedModules(repoRoot, listTestFiles(repoRoot)),
      exemptions: coverageExemptions,
    });
    expect(problems).toEqual([]);
  });
});
