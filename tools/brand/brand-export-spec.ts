/**
 * Pure description of every raster `bun run brand:export` writes: sources,
 * outputs, pixel sizes and byte budgets, plus the PNG and ICO byte helpers the
 * export and its tests share. Paths are relative to `docs/brand/`.
 */

/** One raster rendered from one source file. */
export interface RasterTarget {
  source: string;
  output: string;
  width: number;
  height: number;
  maxBytes: number;
}

/** Pixel sizes of the mark PNGs. */
export const MARK_SIZES = [16, 32, 48, 128, 512] as const;

/** Pixel sizes of the entries inside `favicon.ico`, in file order. */
export const ICO_SIZES = [16, 32, 48] as const;

const MARK_MAX_BYTES = 64 * 1024;
const COVER_MAX_BYTES = 1024 * 1024;
const SMALL_MARK_MAX_SIZE = 16;

/** The simplified mark is drawn for 16 px; every larger size uses the full mark. */
export function markSourceFor(size: number): string {
  return size <= SMALL_MARK_MAX_SIZE ? "logo/mark-small.svg" : "logo/mark.svg";
}

/** The mark PNGs, one per size in `MARK_SIZES`. */
export const MARK_TARGETS: readonly RasterTarget[] = MARK_SIZES.map((size) => ({
  source: markSourceFor(size),
  output: `logo/png/mark-${size}.png`,
  width: size,
  height: size,
  maxBytes: MARK_MAX_BYTES,
}));

/** The favicon, built from the mark renders at `ICO_SIZES`. */
export const ICO_TARGET = { output: "logo/favicon.ico", maxBytes: MARK_MAX_BYTES } as const;

function ogTarget(name: string, width: number, height: number): RasterTarget {
  return {
    source: `og/${name}.html`,
    output: `og/${name}.png`,
    width,
    height,
    maxBytes: COVER_MAX_BYTES,
  };
}

/** The covers and social previews, each rendered from its own HTML page. */
export const OG_TARGETS: {
  source: string;
  output: string;
  width: number;
  height: number;
  maxBytes: number;
}[] = [
  ogTarget("cover", 1280, 440),
  ogTarget("cover-light", 1280, 440),
  ogTarget("social-preview", 1280, 640),
  ogTarget("social-preview-light", 1280, 640),
];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_HEADER_BYTES = 24;
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;
const ICO_MAX_SIZE = 256;

/** Width and height from a PNG header, or `undefined` when the bytes are not a PNG. */
export function readPngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (
    bytes.length < PNG_HEADER_BYTES ||
    PNG_SIGNATURE.some((value, index) => bytes[index] !== value)
  ) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Throws, naming the output, unless `bytes` is a PNG of the target size within its budget. */
export function assertRaster(
  target: Pick<RasterTarget, "output" | "width" | "height" | "maxBytes">,
  bytes: Uint8Array,
): void {
  if (bytes.length > target.maxBytes) {
    throw new Error(
      `${target.output}: ${bytes.length} bytes exceeds the ${target.maxBytes} byte budget`,
    );
  }
  const size = readPngSize(bytes);
  if (size === undefined) {
    throw new Error(`${target.output}: not a PNG`);
  }
  if (size.width !== target.width || size.height !== target.height) {
    throw new Error(
      `${target.output}: expected ${target.width}x${target.height}, got ${size.width}x${size.height}`,
    );
  }
}

function icoEntrySize(png: Uint8Array, index: number): number {
  const size = readPngSize(png);
  if (size === undefined) {
    throw new Error(`favicon.ico: entry ${index} is not a PNG`);
  }
  if (size.width !== size.height) {
    throw new Error(`favicon.ico: entry ${index} is ${size.width}x${size.height}, not square`);
  }
  if (size.width > ICO_MAX_SIZE) {
    throw new Error(`favicon.ico: entry ${index} is ${size.width} px, above ${ICO_MAX_SIZE}`);
  }
  return size.width;
}

/** Packs square PNGs (at most 256 px) into one ICO file with PNG payloads, in the given order. */
export function encodeIco(pngs: Uint8Array[]): Uint8Array {
  const sizes = pngs.map((png, index) => icoEntrySize(png, index));
  const directoryBytes = ICO_HEADER_BYTES + pngs.length * ICO_ENTRY_BYTES;
  const total = pngs.reduce((sum, png) => sum + png.length, directoryBytes);
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, pngs.length, true);
  let dataOffset = directoryBytes;
  pngs.forEach((png, index) => {
    const entryOffset = ICO_HEADER_BYTES + index * ICO_ENTRY_BYTES;
    const dimension = (sizes[index] ?? 0) % ICO_MAX_SIZE;
    view.setUint8(entryOffset, dimension);
    view.setUint8(entryOffset + 1, dimension);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, png.length, true);
    view.setUint32(entryOffset + 12, dataOffset, true);
    output.set(png, dataOffset);
    dataOffset += png.length;
  });
  return output;
}

/** One directory entry of an ICO file. */
export interface IcoEntry {
  width: number;
  height: number;
  byteLength: number;
  offset: number;
}

/** Directory entries of an ICO file in file order; empty when the bytes are not a well-formed ICO. */
export function readIcoEntries(bytes: Uint8Array): IcoEntry[] {
  if (bytes.length < ICO_HEADER_BYTES) {
    return [];
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) {
    return [];
  }
  const entries: IcoEntry[] = [];
  for (let index = 0; index < view.getUint16(4, true); index += 1) {
    const entryOffset = ICO_HEADER_BYTES + index * ICO_ENTRY_BYTES;
    if (entryOffset + ICO_ENTRY_BYTES > bytes.length) {
      return [];
    }
    entries.push({
      width: view.getUint8(entryOffset) || ICO_MAX_SIZE,
      height: view.getUint8(entryOffset + 1) || ICO_MAX_SIZE,
      byteLength: view.getUint32(entryOffset + 8, true),
      offset: view.getUint32(entryOffset + 12, true),
    });
  }
  return entries;
}

const REMOTE_URL = /(?:https?:\/\/|(?<=["'(=])\/\/)[^\s"'()<>]+/gi;

/** Every `http:`, `https:` or protocol-relative URL in an HTML or CSS source, in order. */
export function findRemoteUrls(text: string): string[] {
  return [...text.matchAll(REMOTE_URL)].map(([url]) => url);
}
