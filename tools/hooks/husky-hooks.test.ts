import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findDirectToolCalls } from "./husky-hooks.ts";

const huskyDirectory = resolve(import.meta.dir, "../../.husky");

describe("findDirectToolCalls", () => {
  test.each([
    "oxlint --fix",
    "bun x --no-install commitlint --edit $1",
    "bunx tsc",
    "knip",
    "oxfmt .",
  ])("flags %s", (line) => {
    expect(findDirectToolCalls(line)).toHaveLength(1);
  });

  test("allows scripts, lint-staged and comments", () => {
    const source = [
      "bun x --no-install lint-staged",
      'bun run lint:commit-msg -- "$1"',
      "# commitlint runs through the script",
    ].join("\n");
    expect(findDirectToolCalls(source)).toEqual([]);
  });
});

describe("husky hooks", () => {
  const hooks = readdirSync(huskyDirectory, { withFileTypes: true }).filter((entry) =>
    entry.isFile(),
  );

  test.each(hooks.map((hook) => hook.name))("%s calls scripts, not tools", (name) => {
    const source = readFileSync(join(huskyDirectory, name), "utf8");
    expect(findDirectToolCalls(source)).toEqual([]);
  });

  test("commit-msg runs the lint:commit-msg script", () => {
    expect(readFileSync(join(huskyDirectory, "commit-msg"), "utf8")).toContain(
      "bun run lint:commit-msg",
    );
  });
});
