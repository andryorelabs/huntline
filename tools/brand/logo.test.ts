import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { readTokens } from "./palette.ts";

const BRAND_DIR = path.join(import.meta.dir, "..", "..", "docs", "brand");
const LOGO_DIR = path.join(BRAND_DIR, "logo");
const BRANDBOOK_DIR = path.join(BRAND_DIR, "brandbook");

const LOGO_FILES = [
  "mark.svg",
  "mark-black.svg",
  "mark-white.svg",
  "mark-small.svg",
  "lockup-horizontal.svg",
  "lockup-horizontal-dark.svg",
];

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const COLOUR_ATTRIBUTE =
  /\b(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*[=:]\s*"?([^";>]+)/g;

const HEX_COLOUR = /#[0-9a-f]{3,8}\b/gi;

/** Every hex colour defined in tokens.css, in either theme, lowercased. */
function readPalette(): Set<string> {
  const tokens = readTokens(readFileSync(path.join(BRAND_DIR, "tokens.css"), "utf8"));
  const values = [...Object.values(tokens.dark), ...Object.values(tokens.light)];
  return new Set(values.filter((value) => /^#[0-9a-f]+$/.test(value)));
}

function findColourProblems(fileName: string, svgText: string, palette: Set<string>): string[] {
  const problems: string[] = [];
  for (const [hex] of svgText.matchAll(HEX_COLOUR)) {
    if (!palette.has(hex.toLowerCase())) {
      problems.push(`${fileName}: colour ${hex} is not in tokens.css`);
    }
  }
  for (const [, rawValue] of svgText.matchAll(COLOUR_ATTRIBUTE)) {
    const value = rawValue?.trim() ?? "";
    if (value !== "none" && !value.startsWith("#")) {
      problems.push(`${fileName}: colour ${value} is not in tokens.css`);
    }
  }
  return problems;
}

/** Lists every rule a logo file breaks, each message naming the file. */
function findLogoProblems(fileName: string, svgText: string, palette: Set<string>): string[] {
  const problems = findColourProblems(fileName, svgText, palette);
  const rootTag = /<svg\b[^>]*>/.exec(svgText)?.[0] ?? "";
  if (!/\brole="img"/.test(rootTag)) {
    problems.push(`${fileName}: root <svg> has no role="img"`);
  }
  if (!/\baria-label="[^"]+"/.test(rootTag)) {
    problems.push(`${fileName}: root <svg> has no aria-label`);
  }
  if (/<text\b/.test(svgText)) {
    problems.push(`${fileName}: contains <text>; outline the wordmark to paths`);
  }
  if (/\b(?:xlink:)?href\s*=|url\(|@import|<image\b/.test(svgText)) {
    problems.push(`${fileName}: references another file`);
  }
  const external = svgText.replaceAll(`xmlns="${SVG_NAMESPACE}"`, "").match(/https?:\/\/[^\s"')]+/);
  if (external !== null) {
    problems.push(`${fileName}: external reference ${external[0]}`);
  }
  return problems;
}

/** Lists every http(s) reference in a CSS, HTML or SVG file, ignoring the SVG namespace. */
function findNetworkReferences(fileName: string, text: string): string[] {
  const withoutNamespace = text.replaceAll(`xmlns="${SVG_NAMESPACE}"`, "");
  return [...withoutNamespace.matchAll(/https?:\/\/[^\s"')]+/g)].map(
    ([reference]) => `${fileName}: ${reference}`,
  );
}

function listKitFiles(): string[] {
  const kitFiles = [path.join(BRAND_DIR, "tokens.css")];
  for (const entry of readdirSync(BRANDBOOK_DIR, { recursive: true, encoding: "utf8" })) {
    if (/\.(?:css|html)$/.test(entry)) {
      kitFiles.push(path.join(BRANDBOOK_DIR, entry));
    }
  }
  for (const entry of readdirSync(LOGO_DIR)) {
    if (entry.endsWith(".svg")) {
      kitFiles.push(path.join(LOGO_DIR, entry));
    }
  }
  return kitFiles;
}

describe("docs/brand/logo", () => {
  const palette = readPalette();

  test.each(LOGO_FILES)("%s follows the logo rules", (fileName) => {
    const svgText = readFileSync(path.join(LOGO_DIR, fileName), "utf8");
    expect(findLogoProblems(fileName, svgText, palette)).toEqual([]);
  });

  test("the mark cuts the sail and hull out of the tile instead of painting them", () => {
    const svgText = readFileSync(path.join(LOGO_DIR, "mark.svg"), "utf8");
    const fills = new Set([...svgText.matchAll(/fill="(#[0-9a-f]+)"/g)].map(([, fill]) => fill));
    expect([...fills]).toEqual(["#297cef"]);
  });
});

describe("findLogoProblems", () => {
  const palette = new Set(["#297cef"]);

  test("names the file and the colour that is not in tokens.css", () => {
    const svgText = `<svg xmlns="${SVG_NAMESPACE}" role="img" aria-label="x"><path fill="#FF0000" stroke="white"/></svg>`;
    expect(findLogoProblems("bad.svg", svgText, palette)).toEqual([
      "bad.svg: colour #FF0000 is not in tokens.css",
      "bad.svg: colour white is not in tokens.css",
    ]);
  });

  test("flags missing accessibility attributes, <text> and external references", () => {
    const svgText = `<svg xmlns="${SVG_NAMESPACE}"><text>jobship</text><image href="https://example.com/a.png"/></svg>`;
    expect(findLogoProblems("bad.svg", svgText, palette)).toEqual([
      'bad.svg: root <svg> has no role="img"',
      "bad.svg: root <svg> has no aria-label",
      "bad.svg: contains <text>; outline the wordmark to paths",
      "bad.svg: references another file",
      "bad.svg: external reference https://example.com/a.png",
    ]);
  });
});

describe("brand kit files", () => {
  test("load no font, stylesheet or image over the network", () => {
    const references = listKitFiles().flatMap((filePath) =>
      findNetworkReferences(path.relative(BRAND_DIR, filePath), readFileSync(filePath, "utf8")),
    );
    expect(references).toEqual([]);
  });

  test("fonts.css points only at woff2 files that exist next to it", () => {
    const fontsCss = readFileSync(path.join(BRANDBOOK_DIR, "fonts.css"), "utf8");
    const targets = [...fontsCss.matchAll(/url\(([^)]+)\)/g)].map(([, target]) => target ?? "");
    const shipped = new Set(readdirSync(path.join(BRANDBOOK_DIR, "fonts")));
    expect(targets).toHaveLength(5);
    for (const target of targets) {
      expect(target).toStartWith("fonts/");
      expect(shipped.has(target.slice("fonts/".length))).toBe(true);
    }
    expect(shipped.has("OFL.txt")).toBe(true);
  });

  test("findNetworkReferences names the file and the remote URL", () => {
    const css = '@import url("https://fonts.example.com/css");';
    expect(findNetworkReferences("brandbook/a.css", css)).toEqual([
      "brandbook/a.css: https://fonts.example.com/css",
    ]);
  });
});
