import { describe, expect, test } from "bun:test";
import { checkThreshold } from "./check-threshold.ts";

const table = (functions: string, lines: string): string =>
  [
    "-----------|---------|---------|",
    "File       | % Funcs | % Lines |",
    "-----------|---------|---------|",
    `All files  |  ${functions} |  ${lines} |`,
    " src/a.ts  |  100.00 |  100.00 |",
    "-----------|---------|---------|",
  ].join("\n");

describe("checkThreshold", () => {
  test("passes at or above both limits", () => {
    const result = checkThreshold(table("90.50", "88.00"), { lines: 88, functions: 90 });
    expect(result).toEqual({ ok: true, lines: 88, functions: 90.5, failures: [] });
  });

  test("fails when lines drop below the limit", () => {
    const result = checkThreshold(table("95.00", "87.99"), { lines: 88, functions: 90 });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["Line coverage 87.99% is below the 88% threshold."]);
  });

  test("fails when functions drop below the limit", () => {
    const result = checkThreshold(table("89.00", "95.00"), { lines: 88, functions: 90 });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["Function coverage 89% is below the 90% threshold."]);
  });

  test("fails when the table has no All files row", () => {
    const result = checkThreshold("no table here", { lines: 1, functions: 1 });
    expect(result.ok).toBe(false);
    expect(result.lines).toBeUndefined();
  });
});
