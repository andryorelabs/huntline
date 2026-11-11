import { join } from "node:path";

export const repositoryRoot = join(import.meta.dir, "..", "..");

/**
 * Narrows a parsed JSON value to an object with string keys.
 */
export function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}

/**
 * Reads the root `package.json` as an untyped record.
 */
export async function readRootManifest(): Promise<Record<string, unknown>> {
  const manifest: unknown = await Bun.file(join(repositoryRoot, "package.json")).json();
  if (!isRecord(manifest)) {
    throw new Error("package.json is not a JSON object");
  }
  return manifest;
}

/**
 * Returns the string entries of one object field of the manifest, such as
 * `scripts` or `devDependencies`, keyed by entry name.
 */
export function stringEntriesOf(
  manifest: Record<string, unknown>,
  fieldName: string,
): Map<string, string> {
  const entries = new Map<string, string>();
  const field = manifest[fieldName];
  if (!isRecord(field)) {
    return entries;
  }
  for (const [entryName, entryValue] of Object.entries(field)) {
    if (typeof entryValue === "string") {
      entries.set(entryName, entryValue);
    }
  }
  return entries;
}
