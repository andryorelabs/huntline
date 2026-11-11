import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { contrastRatio, readTokens } from "./palette.ts";

const TOKENS_PATH = path.join(import.meta.dir, "..", "..", "docs", "brand", "tokens.css");

const BODY_TEXT = 7;
const ACCENT_TEXT = 4.5;

/** A foreground token, the background token it sits on, and the minimum ratio between them. */
interface ContrastPair {
  foreground: string;
  background: string;
  minimum: number;
}

const PAIRS: ContrastPair[] = [
  { foreground: "fg", background: "bg", minimum: BODY_TEXT },
  { foreground: "fg", background: "surface", minimum: BODY_TEXT },
  { foreground: "accent-text", background: "bg", minimum: ACCENT_TEXT },
  { foreground: "accent-text", background: "surface", minimum: ACCENT_TEXT },
  { foreground: "muted", background: "surface", minimum: ACCENT_TEXT },
  { foreground: "info", background: "surface", minimum: ACCENT_TEXT },
  { foreground: "on-accent", background: "accent", minimum: ACCENT_TEXT },
  { foreground: "muted", background: "bg", minimum: ACCENT_TEXT },
  { foreground: "ok", background: "bg", minimum: ACCENT_TEXT },
  { foreground: "warn", background: "bg", minimum: ACCENT_TEXT },
  { foreground: "error", background: "bg", minimum: ACCENT_TEXT },
  { foreground: "info", background: "bg", minimum: ACCENT_TEXT },
];

const REQUIRED_TOKENS = [
  "bg",
  "fg",
  "muted",
  "accent",
  "accent-text",
  "on-accent",
  "ok",
  "warn",
  "error",
  "info",
];

/** Lists every pair below its minimum as "theme: fg on bg is 6.20:1, needs 7:1". */
function findContrastFailures(cssText: string): string[] {
  const failures: string[] = [];
  for (const [theme, tokens] of Object.entries(readTokens(cssText))) {
    for (const { foreground, background, minimum } of PAIRS) {
      const foregroundValue = tokens[foreground];
      const backgroundValue = tokens[background];
      const pairName = `${theme}: ${foreground} on ${background}`;
      if (foregroundValue === undefined || backgroundValue === undefined) {
        failures.push(`${pairName} is missing a token`);
        continue;
      }
      const ratio = contrastRatio(foregroundValue, backgroundValue);
      if (ratio < minimum) {
        failures.push(`${pairName} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`);
      }
    }
  }
  return failures;
}

describe("docs/brand/tokens.css", () => {
  const cssText = readFileSync(TOKENS_PATH, "utf8");

  test("defines every semantic token in both themes", () => {
    const tokens = readTokens(cssText);
    for (const theme of ["dark", "light"] as const) {
      const missing = REQUIRED_TOKENS.filter((name) => tokens[theme][name] === undefined);
      expect({ theme, missing }).toEqual({ theme, missing: [] });
    }
  });

  test("body text reaches 7:1 and accent text 4.5:1 in both themes", () => {
    expect(findContrastFailures(cssText)).toEqual([]);
  });

  test("documents the 16-colour ANSI mapping", () => {
    for (const slot of ["0", "1", "2", "3", "4", "7", "8", "9", "10", "11", "12", "15"]) {
      expect(cssText).toMatch(new RegExp(`^\\s*\\*?\\s*${slot}\\s`, "m"));
    }
  });
});

describe("findContrastFailures", () => {
  test("names the pair that falls below its threshold", () => {
    const css = `
      :root { --bg: #0c1015; --surface: #151a20; --fg: #eaeff5; --muted: #979fab;
        --accent: #297cef; --accent-text: #1f4f99; --on-accent: #0b0f0d;
        --ok: #68ca80; --warn: #e6ac3d; --error: #fe7f78; --info: #3b84ea; }
      .light { --bg: #f7faff; --surface: #eaf1fa; --fg: #5c646f; --muted: #5c646f;
        --accent: #297cef; --accent-text: #145ec1; --on-accent: #0b0f0d;
        --ok: #057836; --warn: #825b01; --error: #b02a2d; --info: #145ec1; }
    `;
    const failures = findContrastFailures(css);
    expect(failures).toHaveLength(4);
    expect(failures[0]).toStartWith("dark: accent-text on bg is ");
    expect(failures[1]).toStartWith("dark: accent-text on surface is ");
    expect(failures[2]).toStartWith("light: fg on bg is 5.72:1, needs 7:1");
    expect(failures[3]).toStartWith("light: fg on surface is ");
  });
});
