import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
