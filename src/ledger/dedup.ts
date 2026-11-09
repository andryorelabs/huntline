import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { withLock } from "../core/fs.ts";
import { isObject } from "../core/narrow.ts";
import type { DataDir, Posting, RejectionReason } from "../core/types.ts";
import { eventsPath, readJsonLines } from "./events.ts";

export const LEDGER_FILE = "ledger.jsonl";
const FUZZY_WINDOW_DAYS = 60;
const TITLE_SIMILARITY = 0.8;
const MS_PER_DAY = 86_400_000;
const CANONICAL_ID_SOURCES: ReadonlySet<string> = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "smartrecruiters",
]);
const NOISE_TOKENS: ReadonlySet<string> = new Set(["remote", "m", "f", "d", "w", "x", "the", "a", "and"]);
const COMPANY_SUFFIXES: ReadonlySet<string> = new Set(["inc", "llc", "ltd", "gmbh", "corp", "co", "sa", "bv"]);
const DISTINGUISHING_TOKENS: ReadonlySet<string> = new Set([
  "junior", "jr", "senior", "sr", "staff", "lead", "principal", "head", "intern", "manager",
  "i", "ii", "iii", "iv", "1", "2", "3", "4", "5",
  "frontend", "backend", "fullstack", "mobile", "ios", "android", "data", "ml", "devops", "sre",
  "security", "qa", "platform", "infrastructure", "design", "product", "sales", "marketing",
]);

export type LedgerOutcome = "seen" | "dismissed";

export type LedgerEntry = {
  readonly at: string;
  readonly key: string;
  readonly outcome: LedgerOutcome;
  readonly reason?: RejectionReason;
  readonly posting: Posting;
};

export type DuplicateMatch = {
  readonly key: string;
  readonly matchedBy: "exact" | "fuzzy";
  readonly dismissed: boolean;
  readonly source: "ledger" | "events";
};

function tokenize(text: string, ignored: ReadonlySet<string>): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((token) => token !== "" && !ignored.has(token));
}

function normalizeCompany(company: string): string {
  return tokenize(company, COMPANY_SUFFIXES).join(" ");
}

function normalizeTitle(title: string): string[] {
  return tokenize(title, NOISE_TOKENS);
}

function normalizeLocation(location: string | undefined): string {
  return location === undefined ? "" : tokenize(location, NOISE_TOKENS).join(" ");
}

export function dedupKey(posting: Posting): string {
  const source = posting.source.toLowerCase();
  if (CANONICAL_ID_SOURCES.has(source) && posting.id !== "") return `${source}:${posting.id}`;
  const company = normalizeCompany(posting.company);
  const title = normalizeTitle(posting.title).join(" ");
  const location = normalizeLocation(posting.location);
  return `${company}|${title}|${location}`;
}

function titlesMatch(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) return false;
  const differing = [...union].filter((token) => !(leftSet.has(token) && rightSet.has(token)));
  if (differing.some((token) => DISTINGUISHING_TOKENS.has(token))) return false;
  return (union.size - differing.length) / union.size >= TITLE_SIMILARITY;
}

function locationsCompatible(left: string, right: string): boolean {
  if (left === "" || right === "") return true;
  const rightTokens = new Set(right.split(" "));
  return left.split(" ").some((token) => rightTokens.has(token));
}

function timestampOf(posting: Posting, fallback: string): number {
  const parsed = Date.parse(posting.postedAt ?? fallback);
  return Number.isNaN(parsed) ? Date.parse(fallback) : parsed;
}

export function isFuzzyDuplicate(
  candidate: Posting,
  candidateAt: string,
  incoming: Posting,
  incomingAt: string,
): boolean {
  if (normalizeCompany(candidate.company) !== normalizeCompany(incoming.company)) return false;
  if (!titlesMatch(normalizeTitle(candidate.title), normalizeTitle(incoming.title))) return false;
  if (!locationsCompatible(normalizeLocation(candidate.location), normalizeLocation(incoming.location))) {
    return false;
  }
  const gap = Math.abs(timestampOf(candidate, candidateAt) - timestampOf(incoming, incomingAt));
  return gap <= FUZZY_WINDOW_DAYS * MS_PER_DAY;
}

function isPosting(value: unknown): value is Posting {
  return (
    isObject(value) &&
    typeof value["source"] === "string" &&
    typeof value["company"] === "string" &&
    typeof value["title"] === "string"
  );
}

function isLedgerEntry(value: unknown): value is LedgerEntry {
  return (
    isObject(value) &&
    typeof value["key"] === "string" &&
    typeof value["at"] === "string" &&
    (value["outcome"] === "seen" || value["outcome"] === "dismissed") &&
    isPosting(value["posting"])
  );
}

export function ledgerPath(dir: DataDir): string {
  return path.join(dir.path, LEDGER_FILE);
}

export async function readLedger(dir: DataDir): Promise<LedgerEntry[]> {
  const lines = await withLock(dir.path, () => Promise.resolve(readJsonLines(ledgerPath(dir))));
  return lines.filter(isLedgerEntry);
}

export async function ledgerRecord(
  dir: DataDir,
  posting: Posting,
  outcome: LedgerOutcome,
  reason?: RejectionReason,
): Promise<void> {
  const base = { at: new Date().toISOString(), key: dedupKey(posting), outcome, posting };
  const entry: LedgerEntry = reason === undefined ? base : { ...base, reason };
  await withLock(dir.path, () => {
    mkdirSync(dir.path, { recursive: true });
    appendFileSync(ledgerPath(dir), `${JSON.stringify(entry)}\n`);
    return Promise.resolve();
  });
}

type Candidate = {
  readonly key: string;
  readonly at: string;
  readonly posting: Posting;
  readonly dismissed: boolean;
  readonly source: "ledger" | "events";
};

async function loadCandidates(dir: DataDir): Promise<Candidate[]> {
  const ledger: Candidate[] = (await readLedger(dir)).map((entry) => ({
    key: entry.key,
    at: entry.at,
    posting: entry.posting,
    dismissed: entry.outcome === "dismissed",
    source: "ledger",
  }));
  const events: Candidate[] = [];
  const raws = await withLock(dir.path, () => Promise.resolve(readJsonLines(eventsPath(dir))));
  for (const raw of raws) {
    if (!isObject(raw) || !isPosting(raw["posting"]) || typeof raw["at"] !== "string") continue;
    const kind = raw["kind"];
    if (kind !== "lead.created" && kind !== "posting.seen" && kind !== "posting.dismissed") continue;
    const key = typeof raw["key"] === "string" ? raw["key"] : dedupKey(raw["posting"]);
    events.push({
      key,
      at: raw["at"],
      posting: raw["posting"],
      dismissed: kind === "posting.dismissed",
      source: "events",
    });
  }
  return [...ledger, ...events];
}

function toMatch(candidate: Candidate, matchedBy: "exact" | "fuzzy"): DuplicateMatch {
  return { key: candidate.key, matchedBy, dismissed: candidate.dismissed, source: candidate.source };
}

export async function findDuplicate(dir: DataDir, posting: Posting): Promise<DuplicateMatch | null> {
  const candidates = await loadCandidates(dir);
  const key = dedupKey(posting);
  const exact = candidates.find((candidate) => candidate.key === key || dedupKey(candidate.posting) === key);
  if (exact !== undefined) return toMatch(exact, "exact");
  const now = new Date().toISOString();
  const fuzzy = candidates.find((candidate) =>
    isFuzzyDuplicate(candidate.posting, candidate.at, posting, now),
  );
  return fuzzy === undefined ? null : toMatch(fuzzy, "fuzzy");
}
