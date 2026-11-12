import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ANSWER_KEYS, isTierDKey } from "../apply/answer-keys.ts";
import type { StoredAnswer } from "../apply/answers.ts";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import { validateProfile } from "../core/profile.ts";
import type { DataDir, Profile, Result } from "../core/types.ts";
import { findIdentityLeaks } from "../cv/lint.ts";
import type { Bullet, Fact } from "../cv/types.ts";
import { DOSSIER_SOURCES, dossierLineExists, type DossierSource } from "./dossier.ts";
import { loadIdentityIfPresent } from "./identity-guard.ts";

export type FactProposal = Fact & {
  readonly source: DossierSource;
  readonly cites: readonly string[];
};

export type DossierProposal = {
  readonly facts: FactProposal[];
  readonly bullets: Bullet[];
  readonly profile: Partial<Profile>;
  readonly neverClaim: string[];
  readonly answers: StoredAnswer[];
  readonly removals?: { readonly facts: string[]; readonly bullets: string[] };
};

const PROFILE_FILE = "profile.yaml";
const PROPOSABLE_PROFILE_KEYS = new Set([
  "regions",
  "contractTypes",
  "remote",
  "stack",
  "salaryFloor",
  "excludedCompanies",
  "outreachDailyCap",
  "sources",
]);

function invalid(message: string): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code: "proposal-invalid", message } };
}

function stringList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    items.push(item);
  }
  return items;
}

function objectList(value: unknown, field: string): Result<Record<string, unknown>[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value) || !value.every(isObject)) {
    return invalid(`${field} must be a list of objects`);
  }
  return { ok: true, value: value.filter(isObject) };
}

function parseFacts(value: unknown): Result<FactProposal[]> {
  const rows = objectList(value, "facts");
  if (!rows.ok) return rows;
  const facts: FactProposal[] = [];
  for (const [index, row] of rows.value.entries()) {
    const { id, text, source } = row;
    const tags = stringList(row["tags"]);
    const cites = stringList(row["cites"]);
    if (typeof id !== "string" || id === "" || typeof text !== "string" || text.trim() === "") {
      return invalid(`facts[${index}] needs a non-empty string id and text`);
    }
    if (tags === null) return invalid(`fact ${id}: tags must be a list of strings`);
    if (cites === null || cites.length === 0) {
      return invalid(`fact ${id}: cites must list at least one dossier/<section>.md:<line>`);
    }
    if (!isOneOf(DOSSIER_SOURCES, source)) {
      return invalid(`fact ${id}: source must be one of ${DOSSIER_SOURCES.join(", ")}`);
    }
    facts.push({ id, text, tags, source, cites });
  }
  return { ok: true, value: facts };
}

function parseBullets(value: unknown): Result<Bullet[]> {
  const rows = objectList(value, "bullets");
  if (!rows.ok) return rows;
  const bullets: Bullet[] = [];
  for (const [index, row] of rows.value.entries()) {
    const { id, text, entry, order } = row;
    const tags = stringList(row["tags"]);
    const factIds = stringList(row["factIds"]);
    if (typeof id !== "string" || id === "" || typeof text !== "string" || text.trim() === "") {
      return invalid(`bullets[${index}] needs a non-empty string id and text`);
    }
    if (tags === null || factIds === null) {
      return invalid(`bullet ${id}: tags and factIds must be lists of strings`);
    }
    if (entry !== undefined && typeof entry !== "string") {
      return invalid(`bullet ${id}: entry must be a string`);
    }
    if (order !== undefined && (typeof order !== "number" || !Number.isFinite(order))) {
      return invalid(`bullet ${id}: order must be a number`);
    }
    bullets.push({
      id,
      text,
      tags,
      factIds,
      ...(entry === undefined ? {} : { entry }),
      ...(order === undefined ? {} : { order }),
    });
  }
  return { ok: true, value: bullets };
}

function parseAnswers(value: unknown): Result<StoredAnswer[]> {
  const rows = objectList(value, "answers");
  if (!rows.ok) return rows;
  const answers: StoredAnswer[] = [];
  for (const [index, row] of rows.value.entries()) {
    const { answerKey, scope, text, provenance } = row;
    if (
      typeof answerKey !== "string" ||
      typeof scope !== "string" ||
      scope === "" ||
      typeof text !== "string" ||
      text.trim() === "" ||
      typeof provenance !== "string"
    ) {
      return invalid(`answers[${index}] needs answerKey, scope, text and provenance strings`);
    }
    if (!ANSWER_KEYS.some((entry) => entry.key === answerKey)) {
      return invalid(`answers[${index}]: unknown Answer key "${answerKey}"`);
    }
    if (isTierDKey(answerKey)) {
      return invalid(`answers[${index}]: tier D Answer key "${answerKey}" is never stored`);
    }
    answers.push({ answerKey, scope, text, provenance });
  }
  return { ok: true, value: answers };
}

function parseProfilePart(value: unknown): Result<Partial<Profile>> {
  if (value === undefined) return { ok: true, value: {} };
  if (!isObject(value)) return invalid("profile must be an object");
  const unknown = Object.keys(value).find((key) => !PROPOSABLE_PROFILE_KEYS.has(key));
  if (unknown !== undefined) return invalid(`profile.${unknown} is not a proposable Profile field`);
  return { ok: true, value };
}

function parseRemovals(value: unknown): Result<DossierProposal["removals"]> {
  if (value === undefined) return { ok: true, value: undefined };
  if (!isObject(value)) return invalid("removals must be an object");
  const facts = stringList(value["facts"]);
  const bullets = stringList(value["bullets"]);
  if (facts === null || bullets === null) return invalid("removals lists must hold id strings");
  return { ok: true, value: { facts, bullets } };
}

/** Parses the structure of a proposal JSON document; semantic checks live in validateProposal. */
export function parseProposal(raw: unknown): Result<DossierProposal> {
  if (!isObject(raw)) return invalid("proposal must be a JSON object");
  const facts = parseFacts(raw["facts"]);
  if (!facts.ok) return facts;
  const bullets = parseBullets(raw["bullets"]);
  if (!bullets.ok) return bullets;
  const profile = parseProfilePart(raw["profile"]);
  if (!profile.ok) return profile;
  const neverClaim = stringList(raw["neverClaim"]);
  if (neverClaim === null) return invalid("neverClaim must be a list of strings");
  const answers = parseAnswers(raw["answers"]);
  if (!answers.ok) return answers;
  const removals = parseRemovals(raw["removals"]);
  if (!removals.ok) return removals;
  return {
    ok: true,
    value: {
      facts: facts.value,
      bullets: bullets.value,
      profile: profile.value,
      neverClaim,
      answers: answers.value,
      ...(removals.value === undefined ? {} : { removals: removals.value }),
    },
  };
}

function duplicate(ids: readonly string[]): string | undefined {
  return ids.find((id, index) => ids.indexOf(id) !== index);
}

function checkProfile(dir: DataDir, part: Partial<Profile>): Result<void> {
  if (Object.keys(part).length === 0) return { ok: true, value: undefined };
  const file = path.join(dir.path, PROFILE_FILE);
  let current: unknown = {};
  try {
    if (existsSync(file)) current = Bun.YAML.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return invalid(`${PROFILE_FILE} is not valid YAML: ${errorMessage(error)}`);
  }
  const merged = { ...(isObject(current) ? current : {}), ...part };
  const checked = validateProfile(merged);
  return checked.ok ? { ok: true, value: undefined } : invalid(checked.error.message);
}

/**
 * Checks citations, identity values, Fact bank references, Answer keys and the merged
 * Profile. A tier B, C or D identity value in a fact or bullet fails `identity-leak`.
 */
export function validateProposal(
  dir: DataDir,
  proposal: DossierProposal,
  knownFactIds: readonly string[],
): Result<void> {
  const repeatedFact = duplicate(proposal.facts.map((fact) => fact.id));
  if (repeatedFact !== undefined) return invalid(`fact id "${repeatedFact}" is proposed twice`);
  const repeatedBullet = duplicate(proposal.bullets.map((bullet) => bullet.id));
  if (repeatedBullet !== undefined)
    return invalid(`bullet id "${repeatedBullet}" is proposed twice`);
  for (const fact of proposal.facts) {
    const missing = fact.cites.find((ref) => !dossierLineExists(dir, ref));
    if (missing !== undefined) {
      return invalid(`fact ${fact.id}: citation ${missing} does not name a Dossier line`);
    }
  }
  const available = new Set([...knownFactIds, ...proposal.facts.map((fact) => fact.id)]);
  for (const bullet of proposal.bullets) {
    const unknown = bullet.factIds.find((id) => !available.has(id));
    if (unknown !== undefined) return invalid(`bullet ${bullet.id}: unknown fact "${unknown}"`);
  }
  const identity = loadIdentityIfPresent(dir);
  if (!identity.ok) return identity;
  const texts = [
    ...proposal.facts.map((fact) => ({ label: `fact ${fact.id}`, text: fact.text })),
    ...proposal.bullets.map((bullet) => ({ label: `bullet ${bullet.id}`, text: bullet.text })),
  ];
  for (const { label, text } of texts) {
    const [leak] = findIdentityLeaks(text, identity.value);
    if (leak !== undefined) {
      return {
        ok: false,
        error: {
          code: "identity-leak",
          message: `${label} contains the value of identity field "${leak.field}"`,
        },
      };
    }
  }
  return checkProfile(dir, proposal.profile);
}
