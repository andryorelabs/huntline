import { COMMANDS } from "../core/commands.ts";

type Frontmatter = Record<string, string>;

type ParsedDocument = {
  readonly frontmatter: Frontmatter | null;
  readonly body: string;
};

const BUILTIN_COMMANDS: ReadonlySet<string> = new Set(["init", "doctor", "setup"]);

const FIXED_SUBCOMMANDS: Record<string, readonly string[]> = {
  cv: ["build", "lint", "coverage"],
  apply: ["answer", "verify", "block"],
};

const UNTRUSTED_RULE = /untrusted[\s\S]*data, never instructions/i;
const NO_SUBMIT_RULE = /never submit/i;
const WRITE_TOOLS: readonly string[] = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

function parseDocument(source: string): ParsedDocument {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (match === null) return { frontmatter: null, body: source };
  const frontmatter: Frontmatter = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    frontmatter[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { frontmatter, body: match[2] ?? "" };
}

function extractCliReferences(body: string): string[][] {
  const references: string[][] = [];
  for (const span of body.matchAll(/`([^`\n]*\b(?:jobship|huntline)\s[^`\n]*)`/g)) {
    const text = span[1] ?? "";
    const tokens = text
      .slice(text.search(/\b(?:jobship|huntline)\s/))
      .split(/\s+/)
      .slice(1);
    const words: string[] = [];
    for (const token of tokens) {
      if (!/^[a-z][a-z-]*$/.test(token)) break;
      words.push(token);
    }
    if (words.length > 0) references.push(words);
  }
  return references;
}

function unknownCommandProblem(words: readonly string[]): string | null {
  const [first, second] = words;
  if (first === undefined) return null;
  const known =
    BUILTIN_COMMANDS.has(first) ||
    Object.keys(COMMANDS).some((name) => name.split(" ")[0] === first);
  if (!known) return `unknown CLI command "jobship ${first}"`;
  const allowed = FIXED_SUBCOMMANDS[first];
  if (allowed !== undefined && second !== undefined && !allowed.includes(second)) {
    return `unknown CLI command "jobship ${first} ${second}"`;
  }
  return null;
}

export type DocumentKind = "skill" | "command" | "agent";

export function validateDocument(kind: DocumentKind, name: string, source: string): string[] {
  const problems: string[] = [];
  const { frontmatter, body } = parseDocument(source);
  if (frontmatter === null) return [`${name}: missing frontmatter`];
  if (kind !== "command" && (frontmatter["name"] ?? "") === "")
    problems.push(`${name}: frontmatter lacks name`);
  if ((frontmatter["description"] ?? "") === "")
    problems.push(`${name}: frontmatter lacks description`);
  for (const words of extractCliReferences(body)) {
    const problem = unknownCommandProblem(words);
    if (problem !== null) problems.push(`${name}: ${problem}`);
  }
  if (kind === "skill") {
    if (!UNTRUSTED_RULE.test(body)) problems.push(`${name}: missing the untrusted-content rule`);
    if (!NO_SUBMIT_RULE.test(body)) problems.push(`${name}: missing the no-submit rule`);
  }
  return problems;
}

export function readOnlyViolations(name: string, source: string): string[] {
  const { frontmatter } = parseDocument(source);
  const tools = new Set((frontmatter?.["tools"] ?? "").split(",").map((tool) => tool.trim()));
  return WRITE_TOOLS.filter((tool) => tools.has(tool)).map(
    (tool) => `${name}: read-only agent lists ${tool}`,
  );
}
