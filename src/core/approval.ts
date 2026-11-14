import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeAtomic } from "./fs.ts";
import { errorMessage, isObject } from "./narrow.ts";

export function approvalHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export class IdempotencyMap {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  #read(): Record<string, string> {
    if (!existsSync(this.#filePath)) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.#filePath, "utf8"));
    } catch (error) {
      throw new Error(`idempotency map ${this.#filePath} is unreadable: ${errorMessage(error)}`, {
        cause: error,
      });
    }
    if (!isObject(parsed)) {
      throw new Error(`idempotency map ${this.#filePath} is not a key/value map`);
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  }

  lookup(key: string): string | null {
    const entries = this.#read();
    return Object.hasOwn(entries, key) ? (entries[key] ?? null) : null;
  }

  record(key: string, value: string): void {
    const entries = this.#read();
    if (Object.hasOwn(entries, key)) {
      if (entries[key] === value) return;
      throw new Error(`${key} already recorded as ${entries[key]}; refusing to record ${value}`);
    }
    entries[key] = value;
    writeAtomic(this.#filePath, `${JSON.stringify(entries, null, 2)}\n`);
  }
}

/**
 * Key an Approval batch by its path relative to the data dir, with `/` separators, so a moved or cloned data dir keeps its batches.
 */
export function batchKey(dataDirPath: string, batchPath: string): string {
  const absolute = path.resolve(dataDirPath, batchPath);
  return path.relative(path.resolve(dataDirPath), absolute).split(path.sep).join("/");
}

/**
 * Look up a batch hash by its relative key, falling back to the legacy absolute path key.
 */
export function lookupBatchHash(
  map: IdempotencyMap,
  dataDirPath: string,
  batchPath: string,
): string | null {
  return (
    map.lookup(batchKey(dataDirPath, batchPath)) ?? map.lookup(path.resolve(dataDirPath, batchPath))
  );
}
