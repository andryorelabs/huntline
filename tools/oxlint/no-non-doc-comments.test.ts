import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createLocalRuleLinter } from "./lint-fixture.ts";
import type { LocalRuleLinter } from "./lint-fixture.ts";

let linter: LocalRuleLinter;

beforeAll(async () => {
  linter = await createLocalRuleLinter("no-non-doc-comments");
});

afterAll(async () => {
  await linter.dispose();
});

describe("local/no-non-doc-comments", () => {
  test("rejects an inline line comment", async () => {
    expect(
      await linter.lint("const answer = 42; // explains the answer\nexport { answer };\n"),
    ).toHaveLength(1);
  });

  test("rejects a standalone line comment", async () => {
    expect(await linter.lint("// explains the answer\nexport const answer = 42;\n")).toHaveLength(
      1,
    );
  });

  test("rejects a non-doc block comment", async () => {
    expect(
      await linter.lint("/* explains the answer */\nexport const answer = 42;\n"),
    ).toHaveLength(1);
  });

  test("allows a JSDoc block on a declaration", async () => {
    expect(
      await linter.lint(
        "/**\n * The answer.\n */\nexport function answer(): number {\n  return 42;\n}\n",
      ),
    ).toEqual([]);
  });

  test("allows a shebang line", async () => {
    expect(await linter.lint("#!/usr/bin/env bun\nexport const answer = 42;\n")).toEqual([]);
  });

  test.each([
    "// oxlint-disable-next-line no-console",
    "// eslint-disable-next-line no-console",
    "/* eslint-disable */",
    "/* oxlint-disable */",
    "// @ts-expect-error intentionally wrong",
    "// @ts-ignore",
    "/* istanbul ignore next */",
    "/* c8 ignore next */",
    '/// <reference types="bun" />',
  ])("allows the tool directive %s", async (directive) => {
    expect(await linter.lint(`${directive}\nexport const answer: number = 42;\n`)).toEqual([]);
  });

  test("reports every offending comment in a file", async () => {
    expect(
      await linter.lint("// first\nconst answer = 42; /* second */\nexport { answer };\n"),
    ).toHaveLength(2);
  });
});
