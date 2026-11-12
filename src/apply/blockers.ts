import { randomUUID } from "node:crypto";
import { appendEvent, readEvents } from "../ledger/events.ts";
import type { DataDir, HuntEvent } from "../core/types.ts";
import type { NeedsGroup, NeedsItem } from "./types.ts";

type BlockerScope = "field" | "section" | "application";

const SCOPE_ORDER: readonly BlockerScope[] = ["application", "section", "field"];

const GLOBAL_ANSWER_SCOPE = "global";
const UNANSWERED_PATTERN = /^no answer for(?: \((.+?)\))?: ([\s\S]*)$/u;

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function unansweredDetail(question: string, answerScope: string): string {
  return answerScope === GLOBAL_ANSWER_SCOPE
    ? `no answer for: ${question}`
    : `no answer for (${answerScope}): ${question}`;
}

type Unanswered = { readonly question: string; readonly answerScope: string };

function parseUnanswered(detail: string): Unanswered | null {
  const match = UNANSWERED_PATTERN.exec(detail);
  if (match === null) return null;
  return {
    question: normalizeQuestion(match[2] ?? ""),
    answerScope: match[1] ?? GLOBAL_ANSWER_SCOPE,
  };
}

function dedupeId(detail: string): string {
  const unanswered = parseUnanswered(detail);
  return unanswered === null
    ? `detail\u0000${normalizeQuestion(detail)}`
    : `unanswered\u0000${unanswered.answerScope}\u0000${unanswered.question}`;
}

export async function recordBlocker(
  dir: DataDir,
  key: string,
  scope: BlockerScope,
  detail: string,
): Promise<HuntEvent> {
  const events = await readEvents(dir);
  const resolved = new Set<string>();
  for (const event of events) {
    if (event.kind === "blocker.resolved") resolved.add(event.blockerId);
  }
  const wanted = dedupeId(detail);
  const existing = events.find(
    (event) =>
      event.kind === "blocker.opened" &&
      event.key === key &&
      event.scope === scope &&
      !resolved.has(event.blockerId) &&
      dedupeId(event.detail) === wanted,
  );
  if (existing !== undefined) return existing;
  return appendEvent(dir, {
    kind: "blocker.opened",
    key,
    blockerId: randomUUID(),
    scope,
    detail,
  });
}

function matchesSavedAnswer(
  detail: string,
  isSameQuestion: (question: string) => boolean,
  savedScope: string,
): boolean {
  const unanswered = parseUnanswered(detail);
  if (unanswered === null || !isSameQuestion(unanswered.question)) return false;
  return savedScope === GLOBAL_ANSWER_SCOPE || unanswered.answerScope === savedScope;
}

export async function closeFieldBlockers(
  dir: DataDir,
  isSameQuestion: (question: string) => boolean,
  savedScope: string,
): Promise<number> {
  const events = await readEvents(dir);
  const resolved = new Set<string>();
  for (const event of events) {
    if (event.kind === "blocker.resolved") resolved.add(event.blockerId);
  }
  const toClose = events.flatMap((event) =>
    event.kind === "blocker.opened" &&
    event.scope === "field" &&
    !resolved.has(event.blockerId) &&
    matchesSavedAnswer(event.detail, isSameQuestion, savedScope)
      ? [event.blockerId]
      : [],
  );
  await toClose.reduce(
    (previous, blockerId) =>
      previous
        .then(() => appendEvent(dir, { kind: "blocker.resolved", blockerId }))
        .then(() => undefined),
    Promise.resolve(),
  );
  return toClose.length;
}

export async function listNeeds(dir: DataDir): Promise<NeedsGroup[]> {
  const events = await readEvents(dir);
  const resolved = new Set<string>();
  for (const event of events) {
    if (event.kind === "blocker.resolved") resolved.add(event.blockerId);
  }
  const groups = new Map<string, { key: string; scope: BlockerScope; items: NeedsItem[] }>();
  for (const event of events) {
    if (event.kind !== "blocker.opened" || resolved.has(event.blockerId)) continue;
    const key = event.key ?? "";
    const groupId = `${key}\u0000${event.scope}`;
    const group = groups.get(groupId) ?? { key, scope: event.scope, items: [] };
    group.items.push({ blockerId: event.blockerId, detail: event.detail, at: event.at });
    groups.set(groupId, group);
  }
  return groups
    .values()
    .toArray()
    .toSorted(
      (left, right) =>
        left.key.localeCompare(right.key) ||
        SCOPE_ORDER.indexOf(left.scope) - SCOPE_ORDER.indexOf(right.scope),
    );
}
