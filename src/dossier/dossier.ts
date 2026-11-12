import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import type { DataDir, Result } from "../core/types.ts";
import careerTemplate from "../../templates/dossier/career.md" with { type: "text" };
import identityTemplate from "../../templates/dossier/identity.md" with { type: "text" };
import presenceTemplate from "../../templates/dossier/presence.md" with { type: "text" };
import searchTemplate from "../../templates/dossier/search.md" with { type: "text" };

const DOSSIER_SECTION_NAMES = ["career", "search", "presence", "identity"] as const;
export type DossierSectionName = (typeof DOSSIER_SECTION_NAMES)[number];

const SECTION_STATUSES = ["empty", "partial", "complete"] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export const DOSSIER_SOURCES = ["cv", "github", "linkedin", "interview", "export"] as const;
export type DossierSource = (typeof DOSSIER_SOURCES)[number];

const IDENTITY_TIERS = ["A", "B", "C", "D"] as const;
export type IdentityTier = (typeof IDENTITY_TIERS)[number];

export type IdentityField = {
  readonly name: string;
  readonly tier: IdentityTier;
  readonly value: string;
  readonly line: number;
};

export type DossierSection = {
  readonly name: DossierSectionName;
  readonly file: string;
  readonly status: SectionStatus;
  readonly sources: DossierSource[];
  readonly lines: string[];
};

const DOSSIER_DIRECTORY = "dossier";
const READINESS_VALUE = /^ready: (yes|no)$/;
const IDENTITY_LINE = /^[-*+]\s+([A-Za-z][A-Za-z0-9]*)\s+\[([A-D])\]:\s*(.*?)\s*$/;
const BULLET_START = /^[-*+]\s/;
const TIER_MARKER = /\[[A-D]\]:/;

function templateText(content: unknown): string {
  if (typeof content !== "string") throw new TypeError("a bundled template did not load as text");
  return content;
}

/** Bundled Dossier files keyed by their path inside the data directory. */
export const DOSSIER_TEMPLATES: Readonly<Record<string, string>> = {
  "dossier/career.md": templateText(careerTemplate),
  "dossier/search.md": templateText(searchTemplate),
  "dossier/presence.md": templateText(presenceTemplate),
  "dossier/identity.md": templateText(identityTemplate),
};

function invalid(file: string, problem: string): Result<never> {
  return { ok: false, error: { code: "dossier-invalid", message: `${file}: ${problem}` } };
}

function splitLines(text: string): string[] {
  const withoutBom = text.startsWith("﻿") ? text.slice(1) : text;
  return withoutBom.split(/\r?\n/);
}

function frontMatterEnd(lines: readonly string[]): number {
  if (lines[0]?.trimEnd() !== "---") return -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trimEnd() === "---") return index;
  }
  return -1;
}

type FrontMatter = { readonly status: SectionStatus; readonly sources: DossierSource[] };

function parseFrontMatter(file: string, lines: readonly string[]): Result<FrontMatter> {
  if (lines.every((line) => line.trim() === "")) return invalid(file, "file is empty");
  const end = frontMatterEnd(lines);
  if (end === -1) return invalid(file, "missing or unterminated front matter");
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(lines.slice(1, end).join("\n"));
  } catch (error) {
    return invalid(file, `malformed front matter (${errorMessage(error)})`);
  }
  if (!isObject(parsed)) return invalid(file, "front matter must be a mapping");
  const { status, sources } = parsed;
  if (!isOneOf(SECTION_STATUSES, status)) {
    return invalid(file, `unknown status ${JSON.stringify(status)}`);
  }
  if (!Array.isArray(sources)) return invalid(file, "sources must be a list");
  const known: DossierSource[] = [];
  for (const source of sources) {
    if (!isOneOf(DOSSIER_SOURCES, source)) {
      return invalid(file, `unknown source ${JSON.stringify(source)}`);
    }
    known.push(source);
  }
  return { ok: true, value: { status, sources: known } };
}

function parseIdentityLines(file: string, lines: readonly string[]): Result<IdentityField[]> {
  const fields: IdentityField[] = [];
  let inComment = false;
  const bodyStart = frontMatterEnd(lines) + 1;
  for (const [index, raw] of lines.entries()) {
    if (index < bodyStart) continue;
    const text = raw.trim();
    if (inComment) {
      if (text.includes("-->")) inComment = false;
      continue;
    }
    if (text.startsWith("<!--")) {
      inComment = !text.includes("-->");
      continue;
    }
    if (!BULLET_START.test(text) && !TIER_MARKER.test(text)) continue;
    const match = IDENTITY_LINE.exec(text);
    const [, name, tier, value] = match ?? [];
    if (name === undefined || !isOneOf(IDENTITY_TIERS, tier) || value === undefined) {
      return invalid(file, `line ${index + 1}: malformed identity field`);
    }
    if (tier === "C" && !READINESS_VALUE.test(value)) {
      return invalid(file, `line ${index + 1}: tier C field ${name} may only hold ready: yes|no`);
    }
    fields.push({ name, tier, value, line: index + 1 });
  }
  return { ok: true, value: fields };
}

function sectionFile(name: DossierSectionName): string {
  return `${DOSSIER_DIRECTORY}/${name}.md`;
}

function findUnknownFiles(directory: string): string | null {
  const known = new Set(DOSSIER_SECTION_NAMES.map((name) => `${name}.md`));
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "batches") continue;
    if (!known.has(entry.name)) return `${DOSSIER_DIRECTORY}/${entry.name}`;
  }
  return null;
}

function loadSection(dir: DataDir, name: DossierSectionName): Result<DossierSection> {
  const file = sectionFile(name);
  const absolute = path.join(dir.path, file);
  if (!existsSync(absolute)) return invalid(file, "file is missing");
  const lines = splitLines(readFileSync(absolute, "utf8"));
  const frontMatter = parseFrontMatter(file, lines);
  if (!frontMatter.ok) return frontMatter;
  if (name === "identity") {
    const identity = parseIdentityLines(file, lines);
    if (!identity.ok) return identity;
  }
  const { status, sources } = frontMatter.value;
  return { ok: true, value: { name, file, status, sources, lines } };
}

/** Loads and validates the four Dossier sections; the first problem found is returned. */
export function loadDossier(dir: DataDir): Result<DossierSection[]> {
  try {
    const directory = path.join(dir.path, DOSSIER_DIRECTORY);
    if (!existsSync(directory)) return invalid(DOSSIER_DIRECTORY, "directory is missing");
    const unknown = findUnknownFiles(directory);
    if (unknown !== null) return invalid(unknown, "unknown Dossier section file");
    const sections: DossierSection[] = [];
    for (const name of DOSSIER_SECTION_NAMES) {
      const section = loadSection(dir, name);
      if (!section.ok) return section;
      sections.push(section.value);
    }
    return { ok: true, value: sections };
  } catch (error) {
    return invalid(DOSSIER_DIRECTORY, errorMessage(error));
  }
}

/** Parses the identity section's fields with their Identity tier and 1-based line. */
export function loadIdentityFields(dir: DataDir): Result<IdentityField[]> {
  const file = sectionFile("identity");
  try {
    const absolute = path.join(dir.path, file);
    if (!existsSync(absolute)) return invalid(file, "file is missing");
    const lines = splitLines(readFileSync(absolute, "utf8"));
    const frontMatter = parseFrontMatter(file, lines);
    if (!frontMatter.ok) return frontMatter;
    return parseIdentityLines(file, lines);
  } catch (error) {
    return invalid(file, errorMessage(error));
  }
}

/** True when `ref` (`dossier/<section>.md:<line>`) names a non-blank line of a Dossier section. */
export function dossierLineExists(dir: DataDir, ref: string): boolean {
  const match = /^dossier\/([a-z]+)\.md:(\d+)$/.exec(ref);
  const [, name, lineText] = match ?? [];
  if (!isOneOf(DOSSIER_SECTION_NAMES, name) || lineText === undefined) return false;
  const section = loadSection(dir, name);
  if (!section.ok) return false;
  const line = Number(lineText);
  return line >= 1 && (section.value.lines[line - 1]?.trim() ?? "") !== "";
}
