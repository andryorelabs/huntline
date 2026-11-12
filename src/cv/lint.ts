import type { IdentityField } from "../dossier/dossier.ts";
import type { FactBank, LintFinding } from "./types.ts";

const PHRASE_WORDS = 4;
const TODO_SOURCE = "TODO(?:\\([^)]*\\)|:)";
const PLACEHOLDER_SOURCE =
  "TBD|FIXME|XXX+|lorem ipsum|\\{\\{[^}]*\\}\\}|\\[(?:placeholder|insert[^\\]]*|your [^\\]]*)\\]";
const NUMBER_SOURCE = "\\d[\\d,.]*\\d|\\d";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeNumber(raw: string): string {
  const separators = [...raw.matchAll(/[,.]/g)].map((match) => match[0]);
  if (separators.length === 0) return raw;
  const lastIndex = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  const tail = raw.slice(lastIndex + 1);
  const distinct = new Set(separators);
  if (distinct.size === 1 && (tail.length === 3 || separators.length > 1)) {
    return raw.replace(/[,.]/g, "");
  }
  return `${raw.slice(0, lastIndex).replace(/[,.]/g, "")}.${tail}`;
}

function numbersIn(text: string): string[] {
  return (text.match(new RegExp(NUMBER_SOURCE, "gu")) ?? []).map(normalizeNumber);
}

type Located = { readonly term: string; readonly line: number; readonly column: number };

function locate(text: string, pattern: RegExp): Located[] {
  const found: Located[] = [];
  for (const [lineIndex, line] of text.split("\n").entries()) {
    for (const match of line.matchAll(pattern)) {
      found.push({ term: match[0], line: lineIndex + 1, column: (match.index ?? 0) + 1 });
    }
  }
  return found;
}

/**
 * Finds every case-insensitive, boundary-aware occurrence of `term`, one line at a
 * time, so a value split across lines never matches. Shared by the Never-claim and
 * identity-leak rules.
 */
function findTermHits(text: string, term: string): Located[] {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term.trim())}(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return locate(text, pattern);
}

function neverClaimFindings(text: string, terms: string[]): LintFinding[] {
  return terms
    .filter((term) => term.trim() !== "")
    .flatMap((term) => {
      return findTermHits(text, term).map((hit) => ({
        rule: "never-claim" as const,
        term,
        line: hit.line,
        column: hit.column,
        message: `Never-claim term "${term}" at line ${hit.line}, column ${hit.column}`,
      }));
    });
}

const READINESS_VALUE = /^ready: (yes|no)$/;
const ALLOWED_TIER_A_FIELDS = new Set([
  "name",
  "fullname",
  "email",
  "phone",
  "city",
  "country",
  "links",
]);

/**
 * Answers too common to match as free text: a tier D `No` would otherwise flag every
 * "no" in a CV. Values shorter than three characters are skipped for the same reason.
 */
const NON_DISTINCTIVE_VALUES = new Set([
  "yes",
  "no",
  "none",
  "n/a",
  "not applicable",
  "decline",
  "decline to answer",
  "decline to self-identify",
  "prefer not to say",
  "prefer not to answer",
  "i don't wish to answer",
]);

/** True when a value is distinctive enough to search for in free text. */
function isDistinctiveValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length >= 3 && !NON_DISTINCTIVE_VALUES.has(normalized);
}

/** True when a CV may carry this identity field: only the allowed tier A fields. */
function isCvSafeIdentityField(field: IdentityField): boolean {
  return field.tier === "A" && ALLOWED_TIER_A_FIELDS.has(field.name.toLowerCase());
}

/** The identity fields whose values must never appear in a CV or Fact bank text. */
function guardedIdentityFields(identity: readonly IdentityField[]): IdentityField[] {
  return identity.filter(
    (field) =>
      !isCvSafeIdentityField(field) &&
      isDistinctiveValue(field.value) &&
      !READINESS_VALUE.test(field.value.trim()),
  );
}

type IdentityHit = { readonly field: string; readonly line: number; readonly column: number };

/**
 * Locates guarded identity values in `text`. A hit lying inside a longer hit on the
 * same line is dropped so overlapping values are reported once.
 */
export function findIdentityLeaks(text: string, identity: readonly IdentityField[]): IdentityHit[] {
  const hits = guardedIdentityFields(identity).flatMap((field) =>
    findTermHits(text, field.value).map((hit) => ({
      field: field.name,
      line: hit.line,
      column: hit.column,
      end: hit.column + hit.term.length,
    })),
  );
  return hits
    .filter(
      (hit) =>
        !hits.some(
          (other) =>
            other !== hit &&
            other.line === hit.line &&
            other.column <= hit.column &&
            other.end >= hit.end &&
            (other.column < hit.column || other.end > hit.end),
        ),
    )
    .map(({ field, line, column }) => ({ field, line, column }));
}

function identityLeakFindings(text: string, identity: readonly IdentityField[]): LintFinding[] {
  return findIdentityLeaks(text, identity).map((hit) => ({
    rule: "identity-leak" as const,
    term: hit.field,
    line: hit.line,
    column: hit.column,
    message: `identity field "${hit.field}" appears at line ${hit.line}, column ${hit.column}`,
  }));
}

function placeholderFindings(text: string): LintFinding[] {
  const hits = [
    ...locate(text, new RegExp(TODO_SOURCE, "gu")),
    ...locate(text, new RegExp(PLACEHOLDER_SOURCE, "giu")),
  ];
  return hits.map((hit) => ({
    rule: "placeholder" as const,
    term: hit.term,
    line: hit.line,
    column: hit.column,
    message: `leftover placeholder "${hit.term}" at line ${hit.line}, column ${hit.column}`,
  }));
}

function numberFindings(text: string, facts: FactBank): LintFinding[] {
  const known = new Set(facts.facts.flatMap((fact) => numbersIn(fact.text)));
  const findings: LintFinding[] = [];
  for (const hit of locate(text, new RegExp(NUMBER_SOURCE, "gu"))) {
    if (known.has(normalizeNumber(hit.term))) continue;
    findings.push({
      rule: "unbacked-number",
      term: hit.term,
      line: hit.line,
      column: hit.column,
      message: `number "${hit.term}" at line ${hit.line} is not in the Fact bank`,
    });
  }
  return findings;
}

function repeatedPhraseFindings(text: string): LintFinding[] {
  const words: { word: string; line: number; column: number }[] = [];
  for (const [lineIndex, line] of text.split("\n").entries()) {
    for (const match of line.matchAll(/[\p{L}\p{N}]+/gu)) {
      words.push({
        word: match[0].toLowerCase(),
        line: lineIndex + 1,
        column: (match.index ?? 0) + 1,
      });
    }
  }
  const seen = new Map<string, { line: number; column: number }>();
  const reported = new Set<string>();
  const findings: LintFinding[] = [];
  for (let start = 0; start + PHRASE_WORDS <= words.length; start += 1) {
    const slice = words.slice(start, start + PHRASE_WORDS);
    const phrase = slice.map((entry) => entry.word).join(" ");
    const first = slice[0];
    if (first === undefined) continue;
    const earlier = seen.get(phrase);
    if (earlier === undefined) {
      seen.set(phrase, { line: first.line, column: first.column });
    } else if (!reported.has(phrase)) {
      reported.add(phrase);
      findings.push({
        rule: "repeated-phrase",
        term: phrase,
        line: first.line,
        column: first.column,
        message: `phrase "${phrase}" repeats at line ${first.line} (first at line ${earlier.line})`,
      });
    }
  }
  return findings;
}

export function lintCv(
  text: string,
  ctx: { facts: FactBank; neverClaim: string[]; identity?: readonly IdentityField[] },
): LintFinding[] {
  return [
    ...neverClaimFindings(text, ctx.neverClaim),
    ...identityLeakFindings(text, ctx.identity ?? []),
    ...repeatedPhraseFindings(text),
    ...numberFindings(text, ctx.facts),
    ...placeholderFindings(text),
  ];
}
