import { describe, expect, test } from "bun:test";
import { lintCv, normalizeNumber } from "./lint.ts";
import type { FactBank } from "./types.ts";

function bankWith(text: string): FactBank {
  return { facts: [{ id: "f1", text, tags: [] }] };
}

function rulesFor(cv: string, factText: string): string[] {
  return lintCv(cv, { facts: bankWith(factText), neverClaim: [] }).map((finding) => finding.rule);
}

describe("placeholder rule", () => {
  test("ignores the Spanish word todo", () => {
    expect(rulesFor("Lideré todo el equipo", "x")).not.toContain("placeholder");
  });

  test("still flags TODO markers", () => {
    expect(rulesFor("TODO: fill", "x")).toContain("placeholder");
    expect(rulesFor("TODO(jobship) fill", "x")).toContain("placeholder");
  });
});

describe("normalizeNumber", () => {
  test("treats a single separator before three digits as thousands", () => {
    expect(normalizeNumber("75.000")).toBe("75000");
    expect(normalizeNumber("75,000")).toBe("75000");
  });

  test("treats other single separators as decimals", () => {
    expect(normalizeNumber("4,8")).toBe("4.8");
    expect(normalizeNumber("4.8")).toBe("4.8");
    expect(normalizeNumber("0,25")).toBe("0.25");
  });

  test("handles repeated and mixed separators", () => {
    expect(normalizeNumber("1.234.567")).toBe("1234567");
    expect(normalizeNumber("1,234.5")).toBe("1234.5");
    expect(normalizeNumber("1.234,5")).toBe("1234.5");
  });
});

describe("unbacked-number rule", () => {
  test("matches across locales", () => {
    expect(rulesFor("Ahorré 75.000", "Saved 75,000")).not.toContain("unbacked-number");
    expect(rulesFor("Nota 4,8", "Rated 4.8")).not.toContain("unbacked-number");
  });

  test("flags a different number", () => {
    const findings = rulesFor("Ahorré 76.000", "Saved 75,000").filter(
      (rule) => rule === "unbacked-number",
    );
    expect(findings).toHaveLength(1);
  });
});
