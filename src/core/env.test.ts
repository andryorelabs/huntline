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

  test("an empty value counts as unset", () => {
    expect(settingValue({ JOBSHIP_HOME: "" }, "HOME")).toBeUndefined();
  });

  test("the pre-rename HUNTLINE_ names are not read", () => {
    expect(readSetting({ HUNTLINE_HOME: "/old" }, "HOME")).toBeUndefined();
  });

  test("nothing set gives undefined", () => {
    expect(readSetting({ HOME: "/home/someone" }, "HOME")).toBeUndefined();
    expect(settingValue({}, "HOME")).toBeUndefined();
  });
});
