import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { writeAtomic } from "../core/fs.ts";
import type { DataDir, Result } from "../core/types.ts";
import type { Fact, FactBank } from "../cv/types.ts";

export type FactIndex = FactBank;

export type Finding = {
  readonly rule: "unknown-fact" | "story-without-facts" | "missing-section" | "missing-field";
  readonly line: number;
  readonly message: string;
};

const SECTIONS = ["Rounds", "Question bank", "Signals", "Pitfalls", "Stories"] as const;
const STORY_FIELDS = ["Situation", "Task", "Action", "Result", "Reflection"] as const;
const MAX_SCAFFOLD_STORIES = 5;
const MAX_KEY_LENGTH = 300;

export function isSafeKey(key: string): boolean {
  return key.trim() !== "" && key.length <= MAX_KEY_LENGTH && !key.includes("\0");
}

function packFileName(key: string): string {
  const cleaned = key.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "");
  if (cleaned === key && cleaned !== "" && !cleaned.includes("..")) return cleaned;
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 8);
  return `${cleaned.replace(/\.{2,}/g, ".").slice(0, 60) || "pack"}-${digest}`;
}

export function packPath(dir: DataDir, key: string): string {
  return path.join(dir.path, "prep", `${packFileName(key)}.md`);
}

function storyBlock(fact: Fact, index: number): string {
  return [
    `### Story ${index + 1}: ${fact.id}`,
    "- Situation: TODO",
    "- Task: TODO",
    `- Action: ${fact.text}`,
    "- Result: TODO",
    "- Reflection: TODO",
    `- Facts: ${fact.id}`,
  ].join("\n");
}

function renderPack(key: string, facts: FactIndex): string {
  const stories = facts.facts.slice(0, MAX_SCAFFOLD_STORIES).map(storyBlock);
  return [
    `# Prep pack: ${key}`,
    "",
    "## Rounds",
    "- Recruiter screen: motivation, logistics, compensation range",
    "- Technical interview: role-relevant fundamentals and a live problem",
    "- Behavioral interview: Stories below",
    "",
    "## Question bank",
    "- Why this company and this role?",
    "- Walk me through a project you are proud of.",
    "- Tell me about a time something went wrong.",
    "",
    "## Signals",
    "- TODO: what the Posting says the team values",
    "",
    "## Pitfalls",
    "- TODO: claims the Fact bank does not back",
    "",
    "## Stories",
    "",
    stories.length === 0 ? "TODO: add facts to the Fact bank, then add Stories" : stories.join("\n\n"),
    "",
  ].join("\n");
}

export function scaffoldPrepPack(dir: DataDir, key: string, facts: FactIndex): Result<string> {
  if (!isSafeKey(key)) {
    return { ok: false, error: { code: "usage", message: `unsafe key: ${key}` } };
  }
  const target = packPath(dir, key);
  if (existsSync(target)) {
    return { ok: false, error: { code: "already-exists", message: `${target} already exists` } };
  }
  try {
    writeAtomic(target, renderPack(key, facts));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { code: "internal", message } };
  }
  return { ok: true, value: target };
}

type StoryScan = {
  readonly title: string;
  readonly line: number;
  readonly fields: Set<string>;
  factIds: string[] | null;
};

export function validatePrepPack(markdown: string, facts: FactIndex): Finding[] {
  const known = new Set(facts.facts.map((fact) => fact.id));
  const findings: Finding[] = [];
  const headings = new Set<string>();
  const stories: StoryScan[] = [];
  let inStories = false;
  let current: StoryScan | null = null;
  for (const [offset, raw] of markdown.split("\n").entries()) {
    const line = offset + 1;
    const section = /^## (.+?)\s*$/.exec(raw);
    if (section?.[1] !== undefined) {
      headings.add(section[1]);
      inStories = section[1] === "Stories";
      current = null;
      continue;
    }
    if (!inStories) continue;
    const story = /^### (.+?)\s*$/.exec(raw);
    if (story?.[1] !== undefined) {
      current = { title: story[1], line, fields: new Set(), factIds: null };
      stories.push(current);
      continue;
    }
    const field = /^- ([A-Za-z]+):\s*(.*)$/.exec(raw);
    if (current === null || field?.[1] === undefined) continue;
    if (field[1] === "Facts") {
      const ids = (field[2] ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== "");
      current.factIds = ids;
      for (const id of ids) {
        if (!known.has(id)) {
          findings.push({ rule: "unknown-fact", line, message: `${current.title}: unknown fact id ${id}` });
        }
      }
    } else {
      current.fields.add(field[1]);
    }
  }
  for (const name of SECTIONS) {
    if (!headings.has(name)) findings.push({ rule: "missing-section", line: 1, message: `missing section: ${name}` });
  }
  for (const story of stories) {
    if (story.factIds === null || story.factIds.length === 0) {
      findings.push({ rule: "story-without-facts", line: story.line, message: `${story.title}: no fact ids` });
    }
    for (const field of STORY_FIELDS) {
      if (!story.fields.has(field)) {
        findings.push({ rule: "missing-field", line: story.line, message: `${story.title}: missing ${field}` });
      }
    }
  }
  return findings;
}
