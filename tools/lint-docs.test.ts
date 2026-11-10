import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findBrokenLinks, listMarkdownFiles } from "./lint-docs.ts";

let root = "";

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "lint-docs-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("findBrokenLinks", () => {
  test("accepts links to existing files and directories", () => {
    mkdirSync(path.join(root, "docs"));
    writeFileSync(path.join(root, "docs", "a.md"), "# a\n");
    const index = path.join(root, "index.md");
    writeFileSync(index, "[a](docs/a.md) and [dir](docs)\n");
    expect(findBrokenLinks(index)).toEqual([]);
  });

  test("reports a missing target with its line number", () => {
    const index = path.join(root, "index.md");
    writeFileSync(index, "ok\n[gone](missing.md#top)\n");
    expect(findBrokenLinks(index)).toEqual([{ file: index, line: 2, target: "missing.md#top" }]);
  });

  test("ignores urls, anchors and fenced code", () => {
    const index = path.join(root, "index.md");
    writeFileSync(index, "[x](https://example.com) [y](#top)\n```\n[z](nope.md)\n```\n");
    expect(findBrokenLinks(index)).toEqual([]);
  });
});

describe("listMarkdownFiles", () => {
  test("skips node_modules", () => {
    mkdirSync(path.join(root, "node_modules"));
    writeFileSync(path.join(root, "node_modules", "x.md"), "x\n");
    writeFileSync(path.join(root, "a.md"), "a\n");
    expect(listMarkdownFiles(root)).toEqual([path.join(root, "a.md")]);
  });
});
