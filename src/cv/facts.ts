import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { errorMessage, isObject } from "../core/narrow.ts";
import type { DataDir, Result } from "../core/types.ts";
import type { Bullet, Entry, Fact, FactBank, Profile, SkillGroup, Variant } from "./types.ts";

type Failure = { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

function fail(message: string): Failure {
  return { ok: false, error: { code: "cv-data-invalid", message } };
}

function readYamlDocument(dir: DataDir, file: string, key: string): Result<Record<string, unknown>> {
  const target = path.join(dir.path, file);
  if (!existsSync(target)) return fail(`${file} is missing in ${dir.path}`);
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(readFileSync(target, "utf8"));
  } catch (error) {
    return fail(`${file} is not valid YAML: ${errorMessage(error)}`);
  }
  if (!isObject(parsed)) return fail(`${file} must be a mapping with a ${key} list`);
  return { ok: true, value: parsed };
}

function readYamlList(dir: DataDir, file: string, key: string): Result<unknown[]> {
  const document = readYamlDocument(dir, file, key);
  if (!document.ok) return document;
  const list = document.value[key];
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

function stringMap(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") result[key] = item;
    else if (typeof item === "number") result[key] = String(item);
    else return null;
  }
  return result;
}

function parseProfile(value: unknown): Result<Profile | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (!isObject(value) || typeof value["name"] !== "string") {
    return fail("facts.yaml: profile needs a string name");
  }
  const contact = stringMap(value["contact"]);
  if (contact === null) return fail("facts.yaml: profile contact must map names to strings");
  return { ok: true, value: { name: value["name"], contact } };
}

function parseEntries(value: unknown, key: string): Result<Entry[] | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (!Array.isArray(value)) return fail(`facts.yaml: ${key} must be a list`);
  const entries: Entry[] = [];
  for (const [index, item] of value.entries()) {
    if (!isObject(item) || typeof item["id"] !== "string" || typeof item["name"] !== "string") {
      return fail(`facts.yaml: ${key} entry ${index + 1} needs string id and name`);
    }
    const role = item["role"];
    const dates = item["dates"];
    if (role !== undefined && role !== null && typeof role !== "string") {
      return fail(`facts.yaml: ${key} entry ${item["id"]} has invalid role`);
    }
    if (dates !== undefined && dates !== null && typeof dates !== "string") {
      return fail(`facts.yaml: ${key} entry ${item["id"]} has invalid dates`);
    }
    const metadata = stringMap(item["metadata"]);
    if (metadata === null) return fail(`facts.yaml: ${key} entry ${item["id"]} has invalid metadata`);
    entries.push({
      id: item["id"],
      name: item["name"],
      ...(typeof role === "string" ? { role } : {}),
      ...(typeof dates === "string" ? { dates } : {}),
      metadata,
    });
  }
  return { ok: true, value: entries };
}

function parseSkills(value: unknown): Result<SkillGroup[] | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (!Array.isArray(value)) return fail("facts.yaml: skills must be a list");
  const groups: SkillGroup[] = [];
  for (const [index, item] of value.entries()) {
    if (!isObject(item) || typeof item["name"] !== "string") {
      return fail(`facts.yaml: skills group ${index + 1} needs a string name`);
    }
    const items = stringList(item["items"]);
    if (items === null) return fail(`facts.yaml: skills group ${item["name"]} has invalid items`);
    groups.push({ name: item["name"], items });
  }
  return { ok: true, value: groups };
}

export function loadFactBank(dir: DataDir): Result<FactBank> {
  const document = readYamlDocument(dir, "facts.yaml", "facts");
  if (!document.ok) return document;
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
  const profile = parseProfile(document.value["profile"]);
  if (!profile.ok) return profile;
  const experience = parseEntries(document.value["experience"], "experience");
  if (!experience.ok) return experience;
  const projects = parseEntries(document.value["projects"], "projects");
  if (!projects.ok) return projects;
  const skills = parseSkills(document.value["skills"]);
  if (!skills.ok) return skills;
  return {
    ok: true,
    value: {
      facts,
      ...(profile.value === undefined ? {} : { profile: profile.value }),
      ...(experience.value === undefined ? {} : { experience: experience.value }),
      ...(projects.value === undefined ? {} : { projects: projects.value }),
      ...(skills.value === undefined ? {} : { skills: skills.value }),
    },
  };
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
    const entryId = entry["entry"];
    const order = entry["order"];
    if (entryId !== undefined && entryId !== null && typeof entryId !== "string") {
      return fail(`bullets.yaml: bullet ${entry["id"]} has invalid entry`);
    }
    if (order !== undefined && order !== null && (typeof order !== "number" || !Number.isFinite(order))) {
      return fail(`bullets.yaml: bullet ${entry["id"]} has invalid order`);
    }
    bullets.push({
      id: entry["id"],
      text: entry["text"],
      tags,
      factIds,
      ...(typeof entryId === "string" ? { entry: entryId } : {}),
      ...(typeof order === "number" ? { order } : {}),
    });
  }
  return { ok: true, value: bullets };
}

export function loadVariants(dir: DataDir): Result<Variant[]> {
  const document = readYamlDocument(dir, "bullets.yaml", "bullets");
  if (!document.ok) return document;
  const raw = document.value["variants"];
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!isObject(raw)) return fail("bullets.yaml: variants must map names to rules");
  const variants: Variant[] = [];
  for (const [name, rule] of Object.entries(raw)) {
    if (!isObject(rule)) return fail(`bullets.yaml: variant ${name} must be a mapping`);
    const all = stringList(rule["all"]);
    const any = stringList(rule["any"]);
    const none = stringList(rule["none"]);
    if (all === null || any === null || none === null) {
      return fail(`bullets.yaml: variant ${name} has invalid all, any or none`);
    }
    variants.push({
      name,
      ...(all.length === 0 ? {} : { all }),
      ...(any.length === 0 ? {} : { any }),
      ...(none.length === 0 ? {} : { none }),
    });
  }
  return { ok: true, value: variants };
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
