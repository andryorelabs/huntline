import { describe, expect, test } from "bun:test";
import type { Dimension, Eligibility, Posting, Profile } from "../core/types.ts";
import { evaluateGates } from "./gates.ts";

const profile: Profile = {
  regions: ["latam", "chile"],
  contractTypes: ["full-time", "contract"],
  remote: "remote-only",
  stack: { include: ["typescript", "go"], exclude: ["php"] },
  salaryFloor: { amount: 60000, currency: "USD" },
  excludedCompanies: ["Badco"],
  outreachDailyCap: 5,
  sources: [],
  tracker: { kind: "local" },
};

const base: Posting = {
  id: "p1",
  source: "fixture",
  url: "https://example.test/p1",
  company: "Acme",
  title: "Engineer",
};

type Row = {
  name: string;
  dimension: Dimension;
  posting: Partial<Posting>;
  expected: Eligibility;
  reason?: Dimension;
};

const rows: Row[] = [
  { name: "remote true", dimension: "remote", posting: { remote: true }, expected: "eligible" },
  {
    name: "remote false",
    dimension: "remote",
    posting: { remote: false },
    expected: "ineligible",
    reason: "remote",
  },
  { name: "remote silent", dimension: "remote", posting: {}, expected: "unknown" },
  {
    name: "region match",
    dimension: "region",
    posting: { location: "LatAm" },
    expected: "eligible",
  },
  {
    name: "region worldwide",
    dimension: "region",
    posting: { location: "Worldwide" },
    expected: "eligible",
  },
  {
    name: "region US only",
    dimension: "region",
    posting: { location: "US only" },
    expected: "ineligible",
    reason: "region",
  },
  {
    name: "region remote only is silent",
    dimension: "region",
    posting: { location: "Remote only" },
    expected: "unknown",
  },
  {
    name: "region remote-only is silent",
    dimension: "region",
    posting: { location: "Remote-only" },
    expected: "unknown",
  },
  { name: "region silent", dimension: "region", posting: {}, expected: "unknown" },
  {
    name: "region ambiguous city",
    dimension: "region",
    posting: { location: "Lisbon" },
    expected: "unknown",
  },
  {
    name: "contract match",
    dimension: "contract",
    posting: { contract: "Full_Time" },
    expected: "eligible",
  },
  {
    name: "contract mismatch",
    dimension: "contract",
    posting: { contract: "internship" },
    expected: "ineligible",
    reason: "contract",
  },
  { name: "contract silent", dimension: "contract", posting: {}, expected: "unknown" },
  {
    name: "contract unrecognized",
    dimension: "contract",
    posting: { contract: "seasonal" },
    expected: "unknown",
  },
  {
    name: "stack match",
    dimension: "stack",
    posting: { stack: ["TypeScript", "React"] },
    expected: "eligible",
  },
  {
    name: "stack excluded",
    dimension: "stack",
    posting: { stack: ["php", "typescript"] },
    expected: "ineligible",
    reason: "stack",
  },
  {
    name: "stack no overlap",
    dimension: "stack",
    posting: { stack: ["cobol"] },
    expected: "ineligible",
    reason: "stack",
  },
  { name: "stack silent", dimension: "stack", posting: {}, expected: "unknown" },
  {
    name: "salary above",
    dimension: "salary",
    posting: { salary: { min: 70000, max: 90000, currency: "USD", period: "year" } },
    expected: "eligible",
  },
  {
    name: "salary below",
    dimension: "salary",
    posting: { salary: { max: 40000, currency: "USD", period: "year" } },
    expected: "ineligible",
    reason: "salary",
  },
  { name: "salary silent", dimension: "salary", posting: {}, expected: "unknown" },
  {
    name: "salary other currency",
    dimension: "salary",
    posting: { salary: { max: 100, currency: "EUR" } },
    expected: "unknown",
  },
  {
    name: "salary no currency",
    dimension: "salary",
    posting: { salary: { max: 100 } },
    expected: "unknown",
  },
  { name: "company ok", dimension: "company", posting: { company: "Acme" }, expected: "eligible" },
  {
    name: "company excluded",
    dimension: "company",
    posting: { company: " badco " },
    expected: "ineligible",
    reason: "company",
  },
  { name: "company blank", dimension: "company", posting: { company: "" }, expected: "unknown" },
];

function salaryVerdict(salary: Posting["salary"], floorPeriod?: "year" | "month"): Eligibility {
  return evaluateGates(
    {
      ...profile,
      salaryFloor: {
        amount: 60000,
        currency: "USD",
        ...(floorPeriod === undefined ? {} : { period: floorPeriod }),
      },
    },
    { ...base, ...(salary === undefined ? {} : { salary }) },
  ).eligibility.salary;
}

describe("evaluateGates per dimension", () => {
  for (const row of rows) {
    test(row.name, () => {
      const result = evaluateGates(profile, { ...base, ...row.posting });
      expect(result.eligibility[row.dimension]).toBe(row.expected);
      expect(result.dismissed).toBe(row.expected === "ineligible");
      expect(result.reason).toBe(row.reason);
    });
  }
});

describe("evaluateGates overall", () => {
  test("a fully silent posting is kept with unknown dimensions", () => {
    const result = evaluateGates(profile, base);
    expect(result.dismissed).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(result.eligibility.region).toBe("unknown");
  });

  test("hybrid profiles accept on-site postings", () => {
    const result = evaluateGates({ ...profile, remote: "hybrid" }, { ...base, remote: false });
    expect(result.eligibility.remote).toBe("eligible");
  });

  test("salary gate normalizes the period to yearly", () => {
    expect(salaryVerdict({ max: 4000, currency: "USD", period: "month" })).toBe("ineligible");
    expect(salaryVerdict({ max: 6000, currency: "USD", period: "month" })).toBe("eligible");
    expect(salaryVerdict({ max: 100000, currency: "USD" })).toBe("unknown");
    expect(salaryVerdict({ max: 6000, currency: "USD", period: "month" }, "year")).toBe("eligible");
    expect(salaryVerdict({ max: 70000, currency: "USD", period: "year" }, "month")).toBe(
      "ineligible",
    );
  });

  test("no salary floor never dismisses on salary", () => {
    const result = evaluateGates(
      { ...profile, salaryFloor: null },
      { ...base, salary: { max: 1, currency: "USD" } },
    );
    expect(result.eligibility.salary).toBe("eligible");
  });

  test("every dismissal carries a reason", () => {
    const result = evaluateGates(profile, { ...base, location: "US only", remote: false });
    expect(result.dismissed).toBe(true);
    expect(result.reason).toBe("region");
  });

  test("excluded company wins over other failures", () => {
    const result = evaluateGates(profile, { ...base, company: "Badco", location: "US only" });
    expect(result.reason).toBe("company");
  });
});

describe("region gate aliases", () => {
  const cases: [string[], string, Eligibility][] = [
    [["US"], "Remote - United States", "eligible"],
    [["us"], "Russia", "unknown"],
    [["us"], "Australia", "ineligible"],
    [["LATAM"], "USA only", "ineligible"],
    [["EU"], "Remote, Europe", "eligible"],
    [["EU"], "Neuss", "unknown"],
    [["US"], "Latin America", "ineligible"],
    [["Chile"], "Remote - Argentina", "eligible"],
    [["US"], "Remote (U.S.)", "eligible"],
    [["UK"], "Remote, Britain", "eligible"],
    [["US"], "Worldwide", "eligible"],
  ];
  for (const [regions, location, expected] of cases) {
    test(`${regions.join(",")} vs ${location}`, () => {
      const result = evaluateGates({ ...profile, regions }, { ...base, location });
      expect(result.eligibility.region).toBe(expected);
    });
  }
});
