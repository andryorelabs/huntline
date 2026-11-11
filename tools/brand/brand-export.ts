/**
 * `bun run brand:export`: regenerates every raster of the brand kit under
 * `docs/brand/`. Marks and the favicon come from the SVG marks through sharp;
 * covers and social previews are screenshots of `og/*.html` taken offline in
 * Playwright Chromium. Every raster is checked against `brand-export-spec.ts`
 * before any file is written, and each write goes through a temp file and a
 * rename.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

import {
  assertRaster,
  encodeIco,
  findRemoteUrls,
  ICO_SIZES,
  ICO_TARGET,
  MARK_TARGETS,
  markSourceFor,
  OG_TARGETS,
} from "./brand-export-spec.ts";

const MARK_VIEWBOX = 32;
const SVG_BASE_DENSITY = 72;
const OG_STYLESHEET = "og/og.css";

/** Fonts every og page must have loaded before its screenshot, as CSS font shorthands. */
const REQUIRED_FONTS = ['700 16px "IBM Plex Sans"', '400 16px "IBM Plex Mono"'] as const;

/** What a renderer saw while loading one page. */
export interface PageCapture {
  png: Uint8Array;
  blockedUrls: string[];
  missingFonts: string[];
}

/** Turns a `file:` URL into a PNG at the given viewport. */
export interface PageRenderer {
  capture(url: string, viewport: { width: number; height: number }): Promise<PageCapture>;
  close(): Promise<void>;
}

type PendingWrite = [output: string, bytes: Uint8Array];

function brandDirOf(root: string): string {
  return join(root, "docs", "brand");
}

/**
 * Stages every file as a sibling temp file, and renames them into place only
 * after all of them were staged. A failed stage removes every temp file and
 * leaves the committed files untouched.
 */
async function writeAtomically(brandDir: string, pending: PendingWrite[]): Promise<void> {
  const staged = pending.map(([output, bytes]) => {
    const target = join(brandDir, output);
    return { target, temp: `${target}.tmp-${process.pid}`, bytes };
  });
  const outcomes = await Promise.allSettled(
    staged.map(async ({ target, temp, bytes }) => {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(temp, bytes);
    }),
  );
  const failed = outcomes.find((outcome) => outcome.status === "rejected");
  if (failed !== undefined) {
    await Promise.all(staged.map(({ temp }) => rm(temp, { force: true, recursive: true })));
    throw failed.reason;
  }
  await Promise.all(staged.map(({ target, temp }) => rename(temp, target)));
}

async function renderMark(svg: Uint8Array, size: number): Promise<Uint8Array> {
  const density = (SVG_BASE_DENSITY * size) / MARK_VIEWBOX;
  return new Uint8Array(
    await sharp(svg, { density })
      .resize(size, size)
      .ensureAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toBuffer(),
  );
}

async function readSource(brandDir: string, source: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(join(brandDir, source)));
  } catch (error) {
    throw new Error(`${source}: cannot read the source`, { cause: error });
  }
}

async function prepareMarks(brandDir: string): Promise<PendingWrite[]> {
  const sizes = [...new Set([...MARK_TARGETS.map((target) => target.width), ...ICO_SIZES])];
  const renders = new Map(
    await Promise.all(
      sizes.map(async (size): Promise<[number, Uint8Array]> => {
        const svg = await readSource(brandDir, markSourceFor(size));
        return [size, await renderMark(svg, size)];
      }),
    ),
  );
  const renderOf = (size: number): Uint8Array => {
    const png = renders.get(size);
    if (png === undefined) {
      throw new Error(`no ${size} px mark render`);
    }
    return png;
  };
  const pending = MARK_TARGETS.map((target): PendingWrite => {
    const png = renderOf(target.width);
    assertRaster(target, png);
    return [target.output, png];
  });
  const ico = encodeIco(ICO_SIZES.map((size) => renderOf(size)));
  if (ico.length > ICO_TARGET.maxBytes) {
    throw new Error(
      `${ICO_TARGET.output}: ${ico.length} bytes exceeds the ${ICO_TARGET.maxBytes} byte budget`,
    );
  }
  pending.push([ICO_TARGET.output, ico]);
  return pending;
}

/** Regenerates the mark PNGs and `favicon.ico` under `<root>/docs/brand/`. */
export async function exportMarks(options: { root: string }): Promise<void> {
  const brandDir = brandDirOf(options.root);
  await writeAtomically(brandDir, await prepareMarks(brandDir));
}

async function assertNoRemoteUrls(brandDir: string): Promise<void> {
  const sources = [OG_STYLESHEET, ...OG_TARGETS.map((target) => target.source)];
  const texts = await Promise.all(sources.map((source) => readSource(brandDir, source)));
  sources.forEach((source, index) => {
    const [remote] = findRemoteUrls(new TextDecoder().decode(texts[index]));
    if (remote !== undefined) {
      throw new Error(`${source}: remote URL ${remote}; the kit loads only local files`);
    }
  });
}

async function prepareOg(
  brandDir: string,
  openRenderer?: () => Promise<PageRenderer>,
): Promise<PendingWrite[]> {
  await assertNoRemoteUrls(brandDir);
  const renderer = await (openRenderer ?? openChromiumRenderer)();
  let captures: PageCapture[];
  try {
    captures = await Promise.all(
      OG_TARGETS.map((target) =>
        renderer.capture(pathToFileURL(join(brandDir, target.source)).href, {
          width: target.width,
          height: target.height,
        }),
      ),
    );
  } finally {
    await renderer.close();
  }
  const pending = OG_TARGETS.map((target, index): PendingWrite => {
    const capture = captures[index];
    if (capture === undefined) {
      throw new Error(`${target.source}: no capture`);
    }
    const [blocked] = capture.blockedUrls;
    if (blocked !== undefined) {
      throw new Error(`${target.source}: blocked non-file request ${blocked}`);
    }
    const [missingFont] = capture.missingFonts;
    if (missingFont !== undefined) {
      throw new Error(`${target.source}: font ${missingFont} did not load`);
    }
    assertRaster(target, capture.png);
    return [target.output, capture.png];
  });
  return pending;
}

/** Renders the covers and social previews from `og/*.html` under `<root>/docs/brand/`. */
export async function exportOg(options: {
  root: string;
  openRenderer?: () => Promise<PageRenderer>;
}): Promise<void> {
  const brandDir = brandDirOf(options.root);
  await writeAtomically(brandDir, await prepareOg(brandDir, options.openRenderer));
}

const FONT_CHECK_SCRIPT = `(async (required) => {
  await document.fonts.ready;
  const missing = [];
  for (const font of required) {
    const faces = await document.fonts.load(font).catch(() => []);
    const loaded = faces.length > 0 && faces.every((face) => face.status === "loaded");
    if (!loaded || !document.fonts.check(font)) {
      missing.push(font);
    }
  }
  return missing;
})(${JSON.stringify(REQUIRED_FONTS)})`;

async function findMissingFonts(page: Page): Promise<string[]> {
  const result: unknown = await page.evaluate(FONT_CHECK_SCRIPT);
  if (!Array.isArray(result) || !result.every((entry) => typeof entry === "string")) {
    throw new Error("font check returned an unexpected value");
  }
  return result;
}

/**
 * Chromium to launch: Playwright's own build when installed, else the newest
 * Chromium or headless shell in the Playwright cache, so the export never
 * downloads a browser.
 */
async function findChromium(): Promise<string> {
  const bundled = chromium.executablePath();
  if (existsSync(bundled)) {
    return bundled;
  }
  const cache =
    process.env["PLAYWRIGHT_BROWSERS_PATH"] ?? join(homedir(), ".cache", "ms-playwright");
  const entries = await readdir(cache).catch(() => [] as string[]);
  const candidates = entries
    .flatMap((entry) => {
      const shell = /^chromium_headless_shell-(\d+)$/.exec(entry);
      if (shell?.[1] !== undefined) {
        const path = join(cache, entry, "chrome-headless-shell-linux64", "chrome-headless-shell");
        return [{ revision: Number(shell[1]), path }];
      }
      const full = /^chromium-(\d+)$/.exec(entry);
      if (full?.[1] !== undefined) {
        return [
          { revision: Number(full[1]), path: join(cache, entry, "chrome-linux64", "chrome") },
        ];
      }
      return [];
    })
    .filter((candidate) => existsSync(candidate.path))
    .toSorted((left, right) => right.revision - left.revision);
  const [newest] = candidates;
  if (newest === undefined) {
    throw new Error(`no Chromium found; run "bunx playwright install chromium"`);
  }
  return newest.path;
}

/**
 * A Chromium renderer that aborts and records every request that is not a
 * `file:` URL. `--no-sandbox` is needed because the dev host runs as a
 * container or root user where the Chromium sandbox cannot start; the pages are
 * local files and every network request is blocked.
 */
async function openChromiumRenderer(): Promise<PageRenderer> {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: "reduce" });
  return {
    async capture(url, viewport) {
      const page = await context.newPage();
      const blockedUrls: string[] = [];
      try {
        await page.route(
          (requestUrl) => requestUrl.protocol !== "file:",
          async (route) => {
            blockedUrls.push(route.request().url());
            await route.abort("blockedbyclient");
          },
        );
        await page.setViewportSize(viewport);
        await page.goto(url, { waitUntil: "load" });
        const missingFonts = await findMissingFonts(page);
        const png = await page.screenshot({ type: "png", animations: "disabled" });
        return { png: new Uint8Array(png), blockedUrls, missingFonts };
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
}

/** Regenerates every raster of the kit under `<root>/docs/brand/`. */
export async function exportBrand(options: { root: string }): Promise<void> {
  const brandDir = brandDirOf(options.root);
  const marks = await prepareMarks(brandDir);
  const og = await prepareOg(brandDir);
  await writeAtomically(brandDir, [...marks, ...og]);
}

if (import.meta.main) {
  await exportBrand({ root: join(import.meta.dir, "..", "..") });
}
