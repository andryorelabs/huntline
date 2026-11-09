import type { ApplicationState, EmailClass, HuntEvent } from "../core/types.ts";
import { foldState } from "../ledger/state.ts";
import type {
  ApplicationRecord,
  ClassifiedEmail,
  MatchBand,
  MatchReason,
  ProposedChange,
} from "./types.ts";

export const ATS_BRANDS: ReadonlySet<string> = new Set([
  "greenhouse",
  "greenhouse-mail",
  "lever",
  "ashby",
  "ashbyhq",
  "workable",
  "workablemail",
  "smartrecruiters",
  "workday",
  "myworkday",
  "myworkdayjobs",
  "icims",
  "bamboohr",
  "jobvite",
  "recruitee",
  "teamtailor",
  "breezy",
  "personio",
  "rippling",
  "gem",
  "hirehive",
  "getonboard",
  "himalayas",
  "remoteok",
  "wellfound",
  "linkedin",
  "indeed",
  "glassdoor",
  "ziprecruiter",
  "gmail",
  "googlemail",
  "outlook",
  "hotmail",
  "yahoo",
  "icloud",
  "proton",
  "protonmail",
]);

const COMPANY_SUFFIXES: ReadonlySet<string> = new Set([
  "inc",
  "llc",
  "ltd",
  "limited",
  "gmbh",
  "corp",
  "corporation",
  "co",
  "sa",
  "sas",
  "srl",
  "bv",
  "ag",
  "plc",
  "labs",
  "technologies",
  "technology",
  "tech",
  "group",
]);

const STATE_BY_CLASS: Readonly<Record<EmailClass, ApplicationState | null>> = {
  rejection: "rejected",
  interview: "interviewing",
  offer: "offer",
  "info-request": null,
  other: null,
};

const PROGRESSION: readonly ApplicationState[] = ["applied", "screening", "interviewing", "offer"];

function proposedTransition(current: ApplicationState | null, target: ApplicationState | null): ApplicationState | null {
  if (target === null || current === null) return null;
  const currentRank = PROGRESSION.indexOf(current);
  if (currentRank === -1) return null;
  if (target === "rejected") return target;
  return PROGRESSION.indexOf(target) > currentRank ? target : null;
}

type Candidate = { readonly key: string; readonly band: MatchBand; readonly reason: MatchReason };

function foldAccents(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/\p{M}+/gu, "");
}

function wordsOf(value: string): string[] {
  return foldAccents(value)
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "");
}

export function compactName(value: string): string {
  return foldAccents(value).replace(/[^a-z0-9]+/g, "");
}

export function companyTokens(company: string): string[] {
  const words = wordsOf(company);
  const stripped = words.filter((word) => !COMPANY_SUFFIXES.has(word));
  return stripped.length === 0 ? words : stripped;
}

export function parseSender(from: string): { name: string; domain: string } {
  const angled = /^(.*?)<([^>]+)>\s*$/.exec(from.trim());
  const address = (angled?.[2] ?? from).trim();
  const name = (angled?.[1] ?? "").replace(/^["'\s]+|["'\s]+$/g, "");
  const domain = address.includes("@") ? (address.split("@").pop() ?? "").toLowerCase() : "";
  return { name, domain };
}

function domainLabels(domain: string): string[] {
  return domain.split(".").filter((label) => label !== "");
}

export function isAtsDomain(domain: string): boolean {
  return domainLabels(domain).some(
    (label) => ATS_BRANDS.has(label) || ATS_BRANDS.has(compactName(label)),
  );
}

function containsPhrase(haystack: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false;
  const words = wordsOf(haystack);
  for (let start = 0; start + tokens.length <= words.length; start += 1) {
    if (tokens.every((token, offset) => words[start + offset] === token)) return true;
  }
  return false;
}

function matchesDomain(domain: string, tokens: readonly string[]): boolean {
  if (domain === "" || isAtsDomain(domain)) return false;
  const company = tokens.join("");
  if (company === "") return false;
  const labels = domainLabels(domain);
  const registrable = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  return registrable !== undefined && compactName(registrable) === company;
}

function senderNameMatches(name: string, tokens: readonly string[]): boolean {
  const withoutAts = wordsOf(name).filter((word) => !ATS_BRANDS.has(word));
  return containsPhrase(withoutAts.join(" "), tokens);
}

function candidateFor(email: ClassifiedEmail, application: ApplicationRecord): Candidate | null {
  const tokens = companyTokens(application.company);
  const sender = parseSender(email.from);
  if (matchesDomain(sender.domain, tokens)) {
    return { key: application.key, band: "high", reason: "sender-domain" };
  }
  if (senderNameMatches(sender.name, tokens)) {
    return { key: application.key, band: "medium", reason: "sender-name" };
  }
  if (containsPhrase(email.subject, tokens)) {
    return { key: application.key, band: "medium", reason: "subject" };
  }
  return null;
}

type Resolution = {
  readonly key: string | null;
  readonly keys: string[];
  readonly band: MatchBand;
  readonly reason: MatchReason;
};

function resolveCandidates(candidates: readonly Candidate[]): Resolution {
  const high = candidates.filter((candidate) => candidate.band === "high");
  const pool = high.length > 0 ? high : candidates;
  const keys = [...new Set(pool.map((candidate) => candidate.key))].toSorted();
  const [only] = pool;
  if (only === undefined) return { key: null, keys: [], band: "none", reason: "none" };
  if (keys.length > 1) return { key: null, keys, band: "none", reason: "ambiguous" };
  return { key: only.key, keys, band: only.band, reason: only.reason };
}

export function applicationsFromEvents(events: readonly HuntEvent[]): ApplicationRecord[] {
  const byKey = new Map<string, HuntEvent[]>();
  for (const event of events) {
    if (event.key === undefined) continue;
    byKey.set(event.key, [...(byKey.get(event.key) ?? []), event]);
  }
  const records: ApplicationRecord[] = [];
  for (const [key, group] of byKey) {
    const seed = group.find((event) => event.kind === "lead.created");
    if (seed === undefined || seed.kind !== "lead.created") continue;
    records.push({ key, company: seed.posting.company, state: foldState(group) });
  }
  return records;
}

type ChangeBase = Pick<ProposedChange, "messageId" | "threadId" | "classification">;

function finalize(
  base: ChangeBase,
  application: ApplicationRecord | undefined,
  resolution: Pick<Resolution, "keys" | "band" | "reason">,
): ProposedChange {
  const target = STATE_BY_CLASS[base.classification];
  const confirmed = application !== undefined && resolution.band === "high";
  return {
    ...base,
    key: application?.key ?? null,
    candidates: resolution.keys,
    band: resolution.band,
    reason: resolution.reason,
    confirmed,
    targetState: confirmed && application !== undefined ? proposedTransition(application.state, target) : null,
  };
}

export function matchEmail(
  email: ClassifiedEmail,
  applications: readonly ApplicationRecord[],
  threads: ReadonlyMap<string, string>,
): ProposedChange {
  const base: ChangeBase = {
    messageId: email.messageId,
    threadId: email.threadId,
    classification: email.classification,
  };
  const threadKey = threads.get(email.threadId);
  const threadApplication =
    threadKey === undefined ? undefined : applications.find((record) => record.key === threadKey);
  if (threadApplication !== undefined) {
    return finalize(base, threadApplication, {
      keys: [threadApplication.key],
      band: "high",
      reason: "thread",
    });
  }
  const candidates = applications.flatMap((application) => {
    const candidate = candidateFor(email, application);
    return candidate === null ? [] : [candidate];
  });
  const resolved = resolveCandidates(candidates);
  const application =
    resolved.key === null ? undefined : applications.find((record) => record.key === resolved.key);
  return finalize(base, application, resolved);
}
