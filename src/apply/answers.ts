import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeAtomic } from "../core/fs.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import { isTierDKey, resolveAnswerKey, type AnswerKey } from "./answer-keys.ts";
import { closeFieldBlockers, normalizeQuestion } from "./blockers.ts";
import type { DataDir, Result } from "../core/types.ts";
import type { AnswerResult, AnswerScope } from "./types.ts";

const ANSWERS_FILE = "answers.json";
export const GLOBAL_SCOPE: AnswerScope = "global";

export type StoredAnswer = {
  readonly answerKey: AnswerKey;
  readonly scope: AnswerScope;
  readonly text: string;
  readonly provenance: string;
};

function storageKey(question: string): AnswerKey {
  return resolveAnswerKey(question) ?? normalizeQuestion(question);
}

function toStoredAnswer(value: unknown): StoredAnswer | null {
  if (
    !isObject(value) ||
    typeof value["scope"] !== "string" ||
    typeof value["text"] !== "string" ||
    typeof value["provenance"] !== "string"
  ) {
    return null;
  }
  const { scope, text, provenance } = value;
  if (typeof value["answerKey"] === "string") {
    return { answerKey: value["answerKey"], scope, text, provenance };
  }
  if (typeof value["question"] === "string") {
    return { answerKey: storageKey(value["question"]), scope, text, provenance };
  }
  return null;
}

function readAnswers(dir: DataDir): StoredAnswer[] {
  const file = path.join(dir.path, ANSWERS_FILE);
  if (!existsSync(file)) return [];
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${ANSWERS_FILE} must be a JSON array`);
  return parsed.flatMap((row: unknown) => {
    const answer = toStoredAnswer(row);
    return answer === null ? [] : [answer];
  });
}

export function lookupAnswer(dir: DataDir, question: string, scope: AnswerScope): AnswerResult {
  const wanted = storageKey(question);
  if (wanted === "" || isTierDKey(wanted)) return { status: "abstain" };
  const matches = readAnswers(dir).filter((entry) => entry.answerKey === wanted);
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
  const answerKey = storageKey(question);
  if (answerKey === "")
    return { ok: false, error: { code: "usage", message: "question is empty" } };
  if (provenance.trim() === "") {
    return { ok: false, error: { code: "usage", message: "provenance is required" } };
  }
  if (isTierDKey(answerKey)) {
    return {
      ok: false,
      error: { code: "usage", message: `${answerKey} is never pre-filled and cannot be saved` },
    };
  }
  try {
    const kept = readAnswers(dir).filter(
      (entry) => !(entry.answerKey === answerKey && entry.scope === scope),
    );
    const next = [...kept, { answerKey, scope, text, provenance }];
    writeAtomic(path.join(dir.path, ANSWERS_FILE), `${JSON.stringify(next, null, 2)}\n`);
    await closeFieldBlockers(dir, (asked) => storageKey(asked) === answerKey, scope);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: { code: "internal", message: errorMessage(error) } };
  }
}
