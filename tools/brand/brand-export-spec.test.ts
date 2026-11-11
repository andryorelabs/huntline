import { describe, expect, test } from "bun:test";

import {
  assertRaster,
  encodeIco,
  findRemoteUrls,
  ICO_SIZES,
  ICO_TARGET,
  MARK_SIZES,
  MARK_TARGETS,
  OG_TARGETS,
  readIcoEntries,
  readPngSize,
} from "./brand-export-spec.ts";

const KILOBYTE = 1024;
const MEGABYTE = 1024 * 1024;

/** A minimal PNG header (signature plus IHDR width and height) followed by `padding` zero bytes. */
function fakePng(width: number, height: number, padding = 0): Uint8Array {
  const bytes = new Uint8Array(33 + padding);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("mark targets", () => {
  test("cover 16, 32, 48, 128 and 512 px under logo/png with a 64 KB budget", () => {
    expect(MARK_SIZES).toEqual([16, 32, 48, 128, 512]);
    expect(MARK_TARGETS.map((target) => [target.output, target.width, target.height])).toEqual([
      ["logo/png/mark-16.png", 16, 16],
      ["logo/png/mark-32.png", 32, 32],
      ["logo/png/mark-48.png", 48, 48],
      ["logo/png/mark-128.png", 128, 128],
      ["logo/png/mark-512.png", 512, 512],
    ]);
    expect(MARK_TARGETS.every((target) => target.maxBytes === 64 * KILOBYTE)).toBe(true);
  });

  test("render 16 px from the simplified mark and 32 px and up from the full mark", () => {
    expect(MARK_TARGETS.map((target) => target.source)).toEqual([
      "logo/mark-small.svg",
      "logo/mark.svg",
      "logo/mark.svg",
      "logo/mark.svg",
      "logo/mark.svg",
    ]);
  });

  test("the favicon holds 16, 32 and 48 px entries within 64 KB", () => {
    expect(ICO_SIZES).toEqual([16, 32, 48]);
    expect(ICO_TARGET).toEqual({ output: "logo/favicon.ico", maxBytes: 64 * KILOBYTE });
  });
});

describe("OG_TARGETS", () => {
  test("lists the covers at 1280x440 and the social previews at 1280x640, 1 MB each", () => {
    expect(OG_TARGETS).toEqual([
      {
        source: "og/cover.html",
        output: "og/cover.png",
        width: 1280,
        height: 440,
        maxBytes: MEGABYTE,
      },
      {
        source: "og/cover-light.html",
        output: "og/cover-light.png",
        width: 1280,
        height: 440,
        maxBytes: MEGABYTE,
      },
      {
        source: "og/social-preview.html",
        output: "og/social-preview.png",
        width: 1280,
        height: 640,
        maxBytes: MEGABYTE,
      },
      {
        source: "og/social-preview-light.html",
        output: "og/social-preview-light.png",
        width: 1280,
        height: 640,
        maxBytes: MEGABYTE,
      },
    ]);
  });
});

describe("readPngSize", () => {
  test("reads width and height from the IHDR chunk", () => {
    expect(readPngSize(fakePng(1280, 440))).toEqual({ width: 1280, height: 440 });
  });

  test("returns undefined for bytes that are not a PNG", () => {
    expect(readPngSize(new Uint8Array(40))).toBeUndefined();
    expect(readPngSize(new Uint8Array(3))).toBeUndefined();
  });
});

describe("assertRaster", () => {
  const target = { output: "og/cover.png", width: 1280, height: 440, maxBytes: 100 };

  test("accepts a PNG of the right size within budget", () => {
    expect(() => assertRaster(target, fakePng(1280, 440))).not.toThrow();
  });

  test("names the file and both sizes when dimensions differ", () => {
    expect(() => assertRaster(target, fakePng(1280, 640))).toThrow(
      "og/cover.png: expected 1280x440, got 1280x640",
    );
  });

  test("fails when the byte budget is exceeded", () => {
    expect(() => assertRaster(target, fakePng(1280, 440, 80))).toThrow(
      "og/cover.png: 113 bytes exceeds the 100 byte budget",
    );
  });

  test("fails when the bytes are not a PNG", () => {
    expect(() => assertRaster(target, new Uint8Array(40))).toThrow("og/cover.png: not a PNG");
  });
});

describe("encodeIco", () => {
  test("writes the header, one directory entry per PNG and the payloads at their offsets", () => {
    const pngs = [fakePng(16, 16, 1), fakePng(32, 32, 2), fakePng(48, 48, 3)];
    const ico = encodeIco(pngs);
    const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(3);
    expect(ico.length).toBe(6 + 3 * 16 + 34 + 35 + 36);
    expect(readIcoEntries(ico)).toEqual([
      { width: 16, height: 16, byteLength: 34, offset: 54 },
      { width: 32, height: 32, byteLength: 35, offset: 88 },
      { width: 48, height: 48, byteLength: 36, offset: 123 },
    ]);
    expect(view.getUint16(6 + 4, true)).toBe(1);
    expect(view.getUint16(6 + 6, true)).toBe(32);
    expect(Buffer.from(ico.subarray(88, 88 + 35)).equals(Buffer.from(pngs[1] ?? []))).toBe(true);
  });

  test("stores 256 px as 0 in the directory and reads it back as 256", () => {
    expect(readIcoEntries(encodeIco([fakePng(256, 256)]))[0]?.width).toBe(256);
  });

  test("rejects a payload that is not a square PNG of at most 256 px", () => {
    expect(() => encodeIco([new Uint8Array(40)])).toThrow("entry 0 is not a PNG");
    expect(() => encodeIco([fakePng(16, 32)])).toThrow("entry 0 is 16x32, not square");
    expect(() => encodeIco([fakePng(512, 512)])).toThrow("entry 0 is 512 px, above 256");
  });

  test("readIcoEntries reads nothing from truncated or foreign bytes", () => {
    expect(readIcoEntries(new Uint8Array(3))).toEqual([]);
    expect(readIcoEntries(new Uint8Array([1, 0, 1, 0, 1, 0]))).toEqual([]);
    expect(readIcoEntries(new Uint8Array([0, 0, 1, 0, 2, 0]))).toEqual([]);
  });
});

describe("findRemoteUrls", () => {
  test("finds http, https and protocol-relative references", () => {
    const html = `<link href="https://fonts.example/a.css"><img src="//cdn.example/x.png">
      <style>@import url(http://example.com/b.css);</style>`;
    expect(findRemoteUrls(html)).toEqual([
      "https://fonts.example/a.css",
      "//cdn.example/x.png",
      "http://example.com/b.css",
    ]);
  });

  test("ignores relative and file references", () => {
    expect(findRemoteUrls(`<img src="../logo/mark.svg"><link href="og.css">`)).toEqual([]);
  });
});
