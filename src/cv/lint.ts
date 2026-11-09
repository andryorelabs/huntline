import type { FactBank, LintFinding } from "./types.ts";

const PHRASE_WORDS = 4;
const PLACEHOLDER_SOURCE =
  "TODO(?:\\([^)]*\\))?|TBD|FIXME|XXX+|lorem ipsum|\\{\\{[^}]*\\}\\}|\\[(?:placeholder|insert[^\\]]*|your [^\\]]*)\\]";
const NUMBER_SOURCE = "\\d[\\d,.]*\\d|\\d";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNumber(raw: string): string {
  return raw.replace(/,/g, "").replace(/\.$/, "");
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

function neverClaimFindings(text: string, terms: string[]): LintFinding[] {
  return terms
    .filter((term) => term.trim() !== "")
    .flatMap((term) => {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(term.trim())}(?![\\p{L}\\p{N}])`,
        "giu",
      );
      return locate(text, pattern).map((hit) => ({
        rule: "never-claim" as const,
        term,
        line: hit.line,
        column: hit.column,
        message: `Never-claim term "${term}" at line ${hit.line}, column ${hit.column}`,
      }));
    });
}

function placeholderFindings(text: string): LintFinding[] {
  return locate(text, new RegExp(PLACEHOLDER_SOURCE, "giu")).map((hit) => ({
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
      words.push({ word: match[0].toLowerCase(), line: lineIndex + 1, column: (match.index ?? 0) + 1 });
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
  ctx: { facts: FactBank; neverClaim: string[] },
): LintFinding[] {
  return [
    ...neverClaimFindings(text, ctx.neverClaim),
    ...repeatedPhraseFindings(text),
    ...numberFindings(text, ctx.facts),
    ...placeholderFindings(text),
  ];
}
