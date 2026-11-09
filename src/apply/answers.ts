import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeAtomic } from "../core/fs.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import { closeFieldBlockers, UNANSWERED_PREFIX } from "./blockers.ts";
import type { DataDir, Result } from "../core/types.ts";
import type { AnswerResult, AnswerScope } from "./types.ts";

export const ANSWERS_FILE = "answers.json";
export const GLOBAL_SCOPE: AnswerScope = "global";

type StoredAnswer = {
  readonly question: string;
  readonly scope: AnswerScope;
  readonly text: string;
  readonly provenance: string;
};

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isStoredAnswer(value: unknown): value is StoredAnswer {
  return (
    isObject(value) &&
    typeof value["question"] === "string" &&
    typeof value["scope"] === "string" &&
    typeof value["text"] === "string" &&
    typeof value["provenance"] === "string"
  );
}

function readAnswers(dir: DataDir): StoredAnswer[] {
  const file = path.join(dir.path, ANSWERS_FILE);
  if (!existsSync(file)) return [];
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${ANSWERS_FILE} must be a JSON array`);
  return parsed.filter(isStoredAnswer);
}

export function lookupAnswer(dir: DataDir, question: string, scope: AnswerScope): AnswerResult {
  const wanted = normalizeQuestion(question);
  if (wanted === "") return { status: "abstain" };
  const matches = readAnswers(dir).filter((entry) => entry.question === wanted);
  const found =
    matches.find((entry) => entry.scope === scope) ??
    matches.find((entry) => entry.scope === GLOBAL_SCOPE);
  if (found === undefined) return { status: "abstain" };
  return { status: "answer", text: found.text, provenance: found.provenance };
}

export function listAnswers(dir: DataDir): StoredAnswer[] {
  return readAnswers(dir);
}

export async function saveAnswer(
  dir: DataDir,
  question: string,
  scope: AnswerScope,
  text: string,
  provenance: string,
): Promise<Result<void>> {
  const normalized = normalizeQuestion(question);
  if (normalized === "") return { ok: false, error: { code: "usage", message: "question is empty" } };
  if (provenance.trim() === "") {
    return { ok: false, error: { code: "usage", message: "provenance is required" } };
  }
  try {
    const kept = readAnswers(dir).filter(
      (entry) => !(entry.question === normalized && entry.scope === scope),
    );
    const next = [...kept, { question: normalized, scope, text, provenance }];
    writeAtomic(path.join(dir.path, ANSWERS_FILE), `${JSON.stringify(next, null, 2)}\n`);
    await closeFieldBlockers(
      dir,
      (detail) =>
        detail.startsWith(UNANSWERED_PREFIX) &&
        normalizeQuestion(detail.slice(UNANSWERED_PREFIX.length)) === normalized,
    );
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: { code: "internal", message: errorMessage(error) } };
  }
}
