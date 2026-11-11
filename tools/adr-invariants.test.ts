import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ADR_DIRECTORY = path.join(import.meta.dir, "..", "docs", "adr");
const ADR_FILE = /^(\d{4})-[a-z0-9-]+\.md$/;

const adrFiles = readdirSync(ADR_DIRECTORY).filter((name) => ADR_FILE.test(name));
const index = readFileSync(path.join(ADR_DIRECTORY, "README.md"), "utf8");

describe("ADR index", () => {
  test("every ADR file is linked from the index", () => {
    const missing = adrFiles.filter((name) => !index.includes(`(${name})`));
    expect(missing).toEqual([]);
  });

  test("every indexed ADR file exists", () => {
    const linked = [...index.matchAll(/\((\d{4}-[a-z0-9-]+\.md)\)/g)].map(
      (match) => match[1] ?? "",
    );
    expect(linked.filter((name) => !adrFiles.includes(name))).toEqual([]);
  });

  test("numbers are unique and sequential from 0001", () => {
    const numbers = adrFiles.map((name) => Number(name.slice(0, 4))).toSorted((a, b) => a - b);
    expect(numbers).toEqual(numbers.map((_, position) => position + 1));
  });
});

describe("ADR form", () => {
  const REQUIRED_SECTIONS = ["## Context", "## Decision", "## Consequences"];

  test("a template exists", () => {
    expect(readdirSync(ADR_DIRECTORY)).toContain("template.md");
  });

  for (const name of adrFiles) {
    const text = readFileSync(path.join(ADR_DIRECTORY, name), "utf8");

    test(`${name} has Status and Date header lines`, () => {
      expect(text).toMatch(/^Status: \S.*$/m);
      expect(text).toMatch(/^Date: \d{4}-\d{2}-\d{2}$/m);
    });

    test(`${name} has Context, Decision and Consequences sections`, () => {
      const missing = REQUIRED_SECTIONS.filter((section) => !text.includes(`\n${section}\n`));
      expect(missing).toEqual([]);
    });
  }

  test("the index has Status and Superseded or amended by columns", () => {
    expect(index).toMatch(/^\| #\s+\| Title\s+\| Status\s+\| Superseded or amended by\s+\|$/m);
  });
});
