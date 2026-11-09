import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { errorMessage, isObject } from "../core/narrow.ts";
import type { DataDir, Result } from "../core/types.ts";
import type { Bullet, Fact, FactBank } from "./types.ts";

type Failure = { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

function fail(message: string): Failure {
  return { ok: false, error: { code: "cv-data-invalid", message } };
}

function readYamlList(dir: DataDir, file: string, key: string): Result<unknown[]> {
  const target = path.join(dir.path, file);
  if (!existsSync(target)) return fail(`${file} is missing in ${dir.path}`);
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(readFileSync(target, "utf8"));
  } catch (error) {
    return fail(`${file} is not valid YAML: ${errorMessage(error)}`);
  }
  if (!isObject(parsed)) return fail(`${file} must be a mapping with a ${key} list`);
  const list = parsed[key];
  if (list === undefined || list === null) return { ok: true, value: [] };
  if (!Array.isArray(list)) return fail(`${file}: ${key} must be a list`);
  return { ok: true, value: list };
}

function stringList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    items.push(item);
  }
  return items;
}

export function loadFactBank(dir: DataDir): Result<FactBank> {
  const list = readYamlList(dir, "facts.yaml", "facts");
  if (!list.ok) return list;
  const facts: Fact[] = [];
  for (const [index, entry] of list.value.entries()) {
    if (!isObject(entry) || typeof entry["id"] !== "string" || typeof entry["text"] !== "string") {
      return fail(`facts.yaml: entry ${index + 1} needs string id and text`);
    }
    const tags = stringList(entry["tags"]);
    if (tags === null) return fail(`facts.yaml: fact ${entry["id"]} has invalid tags`);
    facts.push({ id: entry["id"], text: entry["text"], tags });
  }
  return { ok: true, value: { facts } };
}

export function loadBullets(dir: DataDir): Result<Bullet[]> {
  const list = readYamlList(dir, "bullets.yaml", "bullets");
  if (!list.ok) return list;
  const bullets: Bullet[] = [];
  for (const [index, entry] of list.value.entries()) {
    if (!isObject(entry) || typeof entry["id"] !== "string" || typeof entry["text"] !== "string") {
      return fail(`bullets.yaml: entry ${index + 1} needs string id and text`);
    }
    const tags = stringList(entry["tags"]);
    const factIds = stringList(entry["facts"]);
    if (tags === null || factIds === null) {
      return fail(`bullets.yaml: bullet ${entry["id"]} has invalid tags or facts`);
    }
    bullets.push({ id: entry["id"], text: entry["text"], tags, factIds });
  }
  return { ok: true, value: bullets };
}

export function loadNeverClaim(dir: DataDir): Result<string[]> {
  const list = readYamlList(dir, "never-claim.yaml", "terms");
  if (!list.ok) return list;
  const terms: string[] = [];
  for (const entry of list.value) {
    if (typeof entry !== "string") return fail("never-claim.yaml: terms must be strings");
    terms.push(entry);
  }
  return { ok: true, value: terms };
}
