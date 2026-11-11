import { describe, expect, test } from "bun:test";
import { contrastRatio, readTokens } from "./palette.ts";

describe("contrastRatio", () => {
  test("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  test("is symmetric and ignores case", () => {
    expect(contrastRatio("#FFFFFF", "#000")).toBeCloseTo(contrastRatio("#000000", "#fff"), 10);
  });

  test("a colour on itself is 1:1", () => {
    expect(contrastRatio("#297cef", "#297cef")).toBe(1);
  });

  test("matches a published WCAG value", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  test("rejects a value that is not a hex colour", () => {
    expect(() => contrastRatio("blue", "#ffffff")).toThrow('"blue"');
  });
});

describe("readTokens", () => {
  const css = `
/** Dark is the default. */
:root {
  --bg: #0C1015;
  --fg: #eaeff5; /** trailing note */
  --font: "IBM Plex Sans";
}

.light {
  --bg: #f7faff;
}
`;

  test("reads the dark :root block and the .light block", () => {
    expect(readTokens(css)).toEqual({
      dark: { bg: "#0c1015", fg: "#eaeff5", font: '"IBM Plex Sans"' },
      light: { bg: "#f7faff" },
    });
  });

  test("ignores custom properties written inside comments", () => {
    const commented = `/** :root { --ghost: #123456; } */\n${css}`;
    expect(readTokens(commented).dark).not.toHaveProperty("ghost");
  });

  test("fails when a theme block is missing", () => {
    expect(() => readTokens(":root { --bg: #000; }")).toThrow(".light");
    expect(() => readTokens(".light { --bg: #fff; }")).toThrow(":root");
  });
});
