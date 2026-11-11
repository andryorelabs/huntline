import { describe, expect, test } from "bun:test";
import {
  REPO_ROOT,
  assertExpectedRepository,
  readPackageRepository,
  repositoryFromUrl,
  resolveRepository,
} from "./repository.ts";
import type { GhRunner } from "./repository.ts";

const failingGh: GhRunner = () => ({ exitCode: 1, stdout: "", stderr: "not a repo" });

describe("resolveRepository", () => {
  test("runs gh pinned to the checkout, whatever the process cwd is", () => {
    const seen: string[] = [];
    const runGh: GhRunner = (_args, cwd) => {
      seen.push(cwd);
      return { exitCode: 0, stdout: "andryorelabs/jobship\n", stderr: "" };
    };
    const original = process.cwd();
    try {
      process.chdir("/");
      expect(resolveRepository(runGh)).toBe("andryorelabs/jobship");
    } finally {
      process.chdir(original);
    }
    expect(seen).toEqual([REPO_ROOT]);
  });

  test("throws when gh fails", () => {
    expect(() => resolveRepository(failingGh)).toThrow("gh repo view failed: not a repo");
  });
});

describe("package repository guard", () => {
  test("parses the URL forms package.json and git use", () => {
    expect(repositoryFromUrl("git+https://github.com/andryorelabs/jobship.git")).toBe(
      "andryorelabs/jobship",
    );
    expect(repositoryFromUrl("git@github.com:andryorelabs/jobship.git")).toBe(
      "andryorelabs/jobship",
    );
    expect(repositoryFromUrl("https://example.com/x")).toBeUndefined();
  });

  test("package.json names andryorelabs/jobship", () => {
    expect(readPackageRepository()).toBe("andryorelabs/jobship");
  });

  test("accepts a match and refuses a different repository", () => {
    expect(() =>
      assertExpectedRepository("AndryOreLabs/jobship", "andryorelabs/jobship"),
    ).not.toThrow();
    expect(() => assertExpectedRepository("someone/else", "andryorelabs/jobship")).toThrow(
      "refusing to apply",
    );
  });
});
