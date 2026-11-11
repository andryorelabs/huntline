import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { contrastRatio, readTokens } from "./palette.ts";

const BRAND_DIR = path.join(import.meta.dir, "..", "..", "docs", "brand");
const BRANDBOOK_DIR = path.join(BRAND_DIR, "brandbook");
const PAGE_PATH = path.join(BRANDBOOK_DIR, "index.html");
const STYLES_PATH = path.join(BRANDBOOK_DIR, "brandbook.css");

const SECTION_IDS = ["mark", "lockups", "palette", "type", "voice", "terminal-banner", "avoid"];

const FORBIDDEN_REFERENCES = ["../og/", "../logo/png/"];

const HEX_COLOUR = /#[0-9a-f]{3,8}\b/gi;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function readText(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function readBrandFile(relativePath: string): string {
  return readText(path.join(BRAND_DIR, relativePath));
}

function decodeEntities(text: string): string {
  return text.replaceAll(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

function collapse(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

/** Applies a replacement until the text stops changing, so nested markup cannot survive one pass. */
function replaceUntilStable(text: string, pattern: RegExp, replacement: string): string {
  let current = text;
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = current.replaceAll(pattern, replacement);
  }
  return current;
}

function visibleText(html: string): string {
  const withoutBlocks = replaceUntilStable(html, /<(script|style)[\s\S]*?<\/\1>/gi, "");
  const withoutTags = replaceUntilStable(withoutBlocks, /<[^>]*>/g, " ");
  return collapse(decodeEntities(withoutTags));
}

/** The text of the fenced block under the given `##` heading of a Markdown file. */
function fencedBlockUnder(markdown: string, heading: string): string {
  const start = markdown.indexOf(`## ${heading}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = markdown.indexOf("```text\n", start);
  const close = markdown.indexOf("\n```", open + 8);
  return markdown.slice(open + 8, close);
}

/** Every reference a file makes through `src`, `href` and CSS `url()`. */
function readReferences(text: string): string[] {
  const attributes = [...text.matchAll(/\b(?:src|srcset|href)\s*=\s*"([^"]*)"/g)].map(
    (match) => match[1],
  );
  const urls = [...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]);
  return [...attributes, ...urls].filter((value): value is string => value !== undefined);
}

function readIds(html: string): Set<string> {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1] ?? ""));
}

function targetPath(fromFile: string, reference: string): string {
  const withoutFragment = reference.split("#")[0] ?? "";
  const withoutQuery = withoutFragment.split("?")[0] ?? "";
  return path.resolve(path.dirname(fromFile), decodeURIComponent(withoutQuery));
}

function linkedStylesheets(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /rel="stylesheet"/.test(tag))
    .map((tag) => /href="([^"]*)"/.exec(tag)?.[1] ?? "")
    .map((href) => targetPath(PAGE_PATH, href));
}

function sectionOf(html: string, id: string): string {
  return new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? "";
}

/** Token declarations (`--name: #hex`) of a CSS block, as name to lowercase hex. */
function declarations(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map(([, name, value]) => [
      name ?? "",
      (value ?? "").toLowerCase(),
    ]),
  );
}

describe("brandbook page", () => {
  const page = readText(PAGE_PATH);
  const styles = readText(STYLES_PATH);
  const tokens = readTokens(readBrandFile("tokens.css"));

  test("makes no http or https reference in the page or its stylesheets", () => {
    const sources = [page, styles, ...linkedStylesheets(page).map(readText)];
    for (const source of sources) {
      expect(source).not.toMatch(/https?:/i);
      expect(source).not.toMatch(/(?:src|href)\s*=\s*"\/\//);
    }
  });

  test("loads no script and imports no remote stylesheet", () => {
    expect(page).not.toMatch(/<script\b/i);
    expect(page).not.toMatch(/@import/i);
  });

  test("links the local token, font and brandbook stylesheets", () => {
    expect(page).toContain('href="../tokens.css"');
    expect(page).toContain('href="fonts.css"');
    expect(page).toContain('href="brandbook.css"');
  });

  test("resolves every relative link, src, href and url() to an existing file", () => {
    const ids = readIds(page);
    const files = new Set([PAGE_PATH, STYLES_PATH, ...linkedStylesheets(page)]);
    for (const file of files) {
      for (const reference of readReferences(readText(file))) {
        if (reference.startsWith("data:")) {
          continue;
        }
        if (reference.startsWith("#")) {
          expect(ids.has(reference.slice(1))).toBe(true);
          continue;
        }
        expect(existsSync(targetPath(file, reference))).toBe(true);
      }
    }
  });

  test("does not reference assets generated by another ticket", () => {
    for (const forbidden of FORBIDDEN_REFERENCES) {
      expect(page).not.toContain(forbidden);
      expect(styles).not.toContain(forbidden);
    }
  });

  test("has the seven sections in order", () => {
    const positions = SECTION_IDS.map((id) => page.indexOf(`<section id="${id}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions.toSorted((a, b) => a - b)).toEqual(positions);
  });

  test("shows each logo file", () => {
    for (const name of [
      "mark.svg",
      "mark-small.svg",
      "mark-black.svg",
      "mark-white.svg",
      "lockup-horizontal.svg",
      "lockup-horizontal-dark.svg",
    ]) {
      expect(page).toContain(`../logo/${name}`);
    }
  });

  test("shows the favicon-size mark at 16, 32 and 96 px", () => {
    for (const size of [16, 32, 96]) {
      expect(page).toMatch(new RegExp(`mark-small\\.svg"[^>]*width="${size}"`));
    }
  });

  test("contains the terminal banner text exactly, in a pre element", () => {
    const banner = readBrandFile("terminal/banner.txt").replace(/\n$/, "");
    const preBlocks = [...page.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)].map((match) =>
      decodeEntities((match[1] ?? "").replace(/^\n/, "")),
    );
    expect(preBlocks).toContain(banner);
  });

  test("carries the non-affiliation notice verbatim in the footer", () => {
    const notice = fencedBlockUnder(readBrandFile("copy.md"), "non-affiliation notice");
    const footer = /<footer\b[\s\S]*<\/footer>/.exec(page)?.[0] ?? "";
    expect(visibleText(footer)).toContain(notice);
  });

  test("shows the brand line, the plain line and every cell of the we are table", () => {
    const copy = readBrandFile("copy.md");
    const text = visibleText(sectionOf(page, "voice"));
    expect(text).toContain(collapse(fencedBlockUnder(copy, "brand line")));
    expect(text).toContain(collapse(fencedBlockUnder(copy, "plain line")));
    const voice = readBrandFile("voice.md");
    const table = voice.slice(
      voice.indexOf("## We are / we are not"),
      voice.indexOf("## Tone by context"),
    );
    const rows = table
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.startsWith("| -"));
    expect(rows.length).toBeGreaterThan(2);
    for (const row of rows) {
      for (const cell of row.split("|").map(collapse).filter(Boolean)) {
        expect(text).toContain(cell);
      }
    }
  });

  test("lists the avoid list of the brief", () => {
    const brief = readBrandFile("brief.md");
    const section = brief.slice(
      brief.indexOf("## What to avoid"),
      brief.indexOf("## Closed decisions"),
    );
    const labels = [...section.matchAll(/^- \*\*(\w+):\*\*/gm)].map((match) => match[1] ?? "");
    expect(labels).toEqual(["Words", "Imagery", "Colour", "Claims", "Tone"]);
    const avoid = visibleText(sectionOf(page, "avoid"));
    for (const label of labels) {
      expect(avoid).toContain(label);
    }
    for (const word of [
      "AI magic",
      "auto-apply",
      "autonomous",
      "supercharge",
      "land your dream job",
      "while you sleep",
    ]) {
      expect(avoid).toContain(word);
    }
  });

  test("shows contrast figures equal to the computed ratios", () => {
    const figures = [
      ...page.matchAll(/data-contrast="(dark|light):([a-z-]+):([a-z-]+)"[^>]*>\s*([\d.]+):1/g),
    ];
    expect(figures.length).toBe(24);
    for (const [, theme, foreground, background, shown] of figures) {
      const themeTokens = theme === "light" ? tokens.light : tokens.dark;
      const ratio = contrastRatio(
        themeTokens[foreground ?? ""] ?? "",
        themeTokens[background ?? ""] ?? "",
      );
      expect(shown).toBe(ratio.toFixed(2));
    }
  });

  test("shows contrast figures that meet the minimum stated beside them", () => {
    const figures = [
      ...page.matchAll(/data-contrast="[a-z:-]+"\s+data-min="([\d.]+)"[^>]*>\s*([\d.]+):1/g),
    ];
    expect(figures.length).toBe(24);
    for (const [, minimum, shown] of figures) {
      expect(Number(shown)).toBeGreaterThanOrEqual(Number(minimum));
    }
  });

  test("shows every token of both themes with its hex", () => {
    for (const theme of ["dark", "light"] as const) {
      for (const [name, value] of Object.entries(tokens[theme])) {
        expect(page).toMatch(
          new RegExp(`data-swatch="${theme}:${name}"[^>]*>[\\s\\S]*?${value}`, "i"),
        );
      }
    }
  });

  test("uses only colours that tokens.css defines, under the same token name and theme", () => {
    const allowed = new Set(
      [...Object.values(tokens.dark), ...Object.values(tokens.light)].map((value) =>
        value.toLowerCase(),
      ),
    );
    for (const match of styles.matchAll(HEX_COLOUR)) {
      expect(allowed.has(match[0].toLowerCase())).toBe(true);
    }
    for (const [, name, value] of styles.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)) {
      const known = [tokens.dark[name ?? ""], tokens.light[name ?? ""]];
      expect(known).toContain(value?.toLowerCase());
    }
    expect(page).not.toMatch(/style="[^"]*#[0-9a-f]{3,8}\b/i);
  });

  test("repeats the light and dark tokens exactly: same names, same values", () => {
    const lightBlock = /@media \(prefers-color-scheme: light\) \{([\s\S]*?)\n\}/.exec(styles)?.[1];
    const darkBlock = /\.ground-dark \{([\s\S]*?)\n\}/.exec(styles)?.[1];
    expect(lightBlock).toBeDefined();
    expect(darkBlock).toBeDefined();
    expect(declarations(lightBlock ?? "")).toEqual(tokens.light);
    expect(declarations(darkBlock ?? "")).toEqual(tokens.dark);
  });

  test("declares a viewport and guards against sideways scroll", () => {
    expect(page).toContain('name="viewport"');
    expect(styles).toMatch(/overflow-x:\s*(?:clip|hidden)/);
  });
});
