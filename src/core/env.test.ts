import { describe, expect, test } from "bun:test";
import { readSetting, settingValue } from "./env.ts";

const SETTINGS = [
  "HOME",
  "CACHE_DIR",
  "CLAUDE_PLUGINS_FILE",
  "FROM_SOURCE",
  "PREFETCH",
  "RELEASE_BASE_URL",
] as const;

describe("readSetting", () => {
  test.each(SETTINGS)("JOBSHIP_%s is read", (suffix) => {
    expect(readSetting({ [`JOBSHIP_${suffix}`]: "new" }, suffix)).toEqual({
      name: `JOBSHIP_${suffix}`,
      value: "new",
    });
  });

  test.each(SETTINGS)("HUNTLINE_%s is honoured as a fallback", (suffix) => {
    expect(readSetting({ [`HUNTLINE_${suffix}`]: "old" }, suffix)).toEqual({
      name: `HUNTLINE_${suffix}`,
      value: "old",
    });
  });

  test.each(SETTINGS)("JOBSHIP_%s wins over its HUNTLINE_ twin", (suffix) => {
    const env = { [`JOBSHIP_${suffix}`]: "new", [`HUNTLINE_${suffix}`]: "old" };
    expect(settingValue(env, suffix)).toBe("new");
  });

  test("an empty value counts as unset, so the legacy twin still applies", () => {
    expect(settingValue({ JOBSHIP_HOME: "", HUNTLINE_HOME: "/legacy" }, "HOME")).toBe("/legacy");
  });

  test("neither set gives undefined", () => {
    expect(readSetting({ HOME: "/home/someone" }, "HOME")).toBeUndefined();
    expect(settingValue({ HUNTLINE_HOME: "" }, "HOME")).toBeUndefined();
  });
});
