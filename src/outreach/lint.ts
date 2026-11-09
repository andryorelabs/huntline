import type { Draft, LintFinding, Recipient } from "./types.ts";

export const LINKEDIN_MAX_CHARS = 300;
export const EMAIL_MAX_WORDS = 160;

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /\[[^\]\n]{1,60}\]/,
  /\{\{[^}\n]{1,60}\}\}/,
  /<[A-Za-z][^>\n]{0,40}>/,
  /\b(?:TODO|TBD|FIXME|XXX)\b/,
  /\b(?:lorem ipsum|insert (?:name|company)|your name here)\b/i,
];

const STOCK_PHRASES: readonly string[] = [
  "i hope this message finds you well",
  "i hope this email finds you well",
  "i came across your profile",
  "i am writing to express my interest",
  "i'm writing to express my interest",
  "to whom it may concern",
  "i would love to pick your brain",
  "passionate about",
  "synergy",
  "rockstar",
  "ninja",
  "touch base",
  "circle back",
];

const GREETING = /^\s*(?:hi|hello|hey|dear|hola)\s+([\p{L}][\p{L}'’-]*)/iu;

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "").length;
}

function normalize(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function firstName(fullName: string): string {
  return normalize(fullName.split(/\s+/)[0] ?? "");
}

function lengthFinding(draft: Draft): LintFinding | null {
  if (draft.channel === "linkedin") {
    const length = [...draft.body].length;
    if (length > LINKEDIN_MAX_CHARS) {
      return {
        rule: "too-long",
        message: `LinkedIn note has ${length} characters; the cap is ${LINKEDIN_MAX_CHARS}`,
      };
    }
    return null;
  }
  const words = countWords(draft.body);
  if (words > EMAIL_MAX_WORDS) {
    return { rule: "too-long", message: `email has ${words} words; the cap is ${EMAIL_MAX_WORDS}` };
  }
  return null;
}

function placeholderFindings(body: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const match = pattern.exec(body);
    if (match !== null) {
      findings.push({ rule: "placeholder", message: `placeholder left in text: ${match[0]}` });
    }
  }
  return findings;
}

function stockPhraseFindings(body: string): LintFinding[] {
  const lowered = body.toLowerCase().replace(/’/g, "'");
  return STOCK_PHRASES.filter((phrase) => lowered.includes(phrase)).map((phrase) => ({
    rule: "stock-phrase" as const,
    message: `stock phrase: "${phrase}"`,
  }));
}

function nameFindings(draft: Draft, recipient: Recipient): LintFinding[] {
  const expected = firstName(recipient.name);
  const findings: LintFinding[] = [];
  const greeted = GREETING.exec(draft.body)?.[1];
  if (greeted !== undefined && normalize(greeted) !== expected) {
    findings.push({
      rule: "wrong-name",
      message: `greeting addresses "${greeted}" but the recipient is "${recipient.name}"`,
    });
  }
  if (draft.addressee !== undefined && firstName(draft.addressee) !== expected) {
    findings.push({
      rule: "wrong-name",
      message: `Draft addressee "${draft.addressee}" does not match recipient "${recipient.name}"`,
    });
  }
  return findings;
}

function companyFindings(draft: Draft, company: string): LintFinding[] {
  if (draft.company === undefined) return [];
  if (normalize(draft.company) === normalize(company)) return [];
  return [
    {
      rule: "wrong-company",
      message: `Draft company "${draft.company}" does not match "${company}"`,
    },
  ];
}

export function lintDraft(
  draft: Draft,
  ctx: { recipient: Recipient; company: string },
): LintFinding[] {
  if (draft.body.trim() === "") return [{ rule: "empty", message: "Draft is empty" }];
  const length = lengthFinding(draft);
  return [
    ...(length === null ? [] : [length]),
    ...placeholderFindings(draft.body),
    ...stockPhraseFindings(draft.body),
    ...nameFindings(draft, ctx.recipient),
    ...companyFindings(draft, ctx.company),
  ];
}
