import { describe, expect, test } from "bun:test";
import { lintCv, normalizeNumber } from "./lint.ts";
import type { IdentityField } from "../dossier/dossier.ts";
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

describe("identity-leak rule", () => {
  const identity: IdentityField[] = [
    { name: "streetAddress", tier: "A", value: "123 Example St", line: 1 },
    { name: "fullName", tier: "A", value: "Jane Example", line: 2 },
    { name: "dateOfBirth", tier: "B", value: "1990-01-01", line: 3 },
    { name: "passportNumber", tier: "C", value: "ready: yes", line: 4 },
  ];

  function leaks(cv: string, fields: IdentityField[] = identity) {
    return lintCv(cv, { facts: bankWith("x"), neverClaim: [], identity: fields }).filter(
      (finding) => finding.rule === "identity-leak",
    );
  }

  test("flags a tier A field outside the CV-safe set and names the field", () => {
    const [finding, ...rest] = leaks("Lives at 123 EXAMPLE st today");
    expect(rest).toHaveLength(0);
    expect(finding?.term).toBe("streetAddress");
    expect(finding?.message).not.toContain("123");
  });

  test("flags tier B values", () => {
    expect(leaks("Born 1990-01-01")).toHaveLength(1);
  });

  test("allows the name and ignores readiness values", () => {
    expect(leaks("Jane Example, ready: yes")).toHaveLength(0);
  });

  test("a value inside a longer word does not match", () => {
    expect(leaks("12 Example Street")).toHaveLength(0);
    expect(leaks("123 Example Street")).toHaveLength(0);
    expect(leaks("123 Example St.")).toHaveLength(1);
  });

  test("common answers such as a tier D No are not matched as free text", () => {
    const fields: IdentityField[] = [
      { name: "veteran", tier: "D", value: "No", line: 1 },
      { name: "disability", tier: "D", value: "Prefer not to say", line: 2 },
      { name: "initials", tier: "B", value: "JE", line: 3 },
    ];
    expect(leaks("Shipped with no downtime; prefer not to say more. JE", fields)).toHaveLength(0);
  });

  test("a distinctive tier D value is still flagged", () => {
    const fields: IdentityField[] = [{ name: "ethnicity", tier: "D", value: "Examplean", line: 1 }];
    expect(leaks("Proud Examplean engineer", fields)).toHaveLength(1);
  });

  test("overlapping values are reported once", () => {
    const fields: IdentityField[] = [
      { name: "streetAddress", tier: "A", value: "123 Example St", line: 1 },
      { name: "street", tier: "A", value: "Example St", line: 2 },
    ];
    expect(leaks("at 123 Example St", fields)).toHaveLength(1);
  });

  test("a value split across lines is not matched", () => {
    expect(leaks("123 Example\nSt")).toHaveLength(0);
  });
});
