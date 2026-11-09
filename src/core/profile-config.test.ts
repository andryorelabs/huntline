import { describe, expect, test } from "bun:test";
import { validateProfile } from "./profile.ts";

const base = {
  regions: ["chile"],
  contractTypes: ["full-time"],
  remote: "any",
  stack: { include: [], exclude: [] },
  salaryFloor: null,
  excludedCompanies: [],
  outreachDailyCap: 5,
  sources: [],
  tracker: { kind: "linear", team: "HNT" },
};

describe("profile tracker config and salary period", () => {
  test("accepts the new optional tracker keys", () => {
    const result = validateProfile({
      ...base,
      tracker: {
        kind: "linear",
        team: "HNT",
        states: { lead: "Lead", applied: "Applied" },
        channelLabels: { linkedin: "channel:linkedin" },
        channelLabelPrefix: "via:",
        titleFormat: "company-role",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tracker.states).toEqual({ lead: "Lead", applied: "Applied" });
      expect(result.value.tracker.titleFormat).toBe("company-role");
    }
  });

  test("rejects unknown states, bad titleFormat and bad label values", () => {
    for (const tracker of [
      { kind: "linear", states: { nope: "X" } },
      { kind: "linear", states: { lead: "" } },
      { kind: "linear", titleFormat: "other" },
      { kind: "linear", channelLabels: { linkedin: 3 } },
      { kind: "linear", channelLabelPrefix: 3 },
    ]) {
      expect(validateProfile({ ...base, tracker }).ok).toBe(false);
    }
  });

  test("accepts salaryFloor.period and rejects an invalid one", () => {
    const ok = validateProfile({ ...base, salaryFloor: { amount: 5000, currency: "USD", period: "month" } });
    expect(ok.ok && ok.value.salaryFloor?.period).toBe("month");
    const bad = validateProfile({ ...base, salaryFloor: { amount: 5000, currency: "USD", period: "week" } });
    expect(bad.ok).toBe(false);
  });

  test("still rejects unknown top-level keys", () => {
    expect(validateProfile({ ...base, extra: 1 }).ok).toBe(false);
  });
});
