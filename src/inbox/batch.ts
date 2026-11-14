import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { approvalHash, batchKey, IdempotencyMap, lookupBatchHash } from "../core/approval.ts";
import type { CommandContext } from "../core/commands.ts";
import { loadProfile } from "../core/data-dir.ts";
import { withLock, writeAtomic } from "../core/fs.ts";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import { APPLICATION_STATES, type DataDir, type HuntEvent, type Result } from "../core/types.ts";
import { appendEvent, readEvents } from "../ledger/events.ts";
import { createTracker, projectEvents } from "../tracker/index.ts";
import { applicationsFromEvents, matchEmail } from "./match.ts";
import {
  EMAIL_CLASSES,
  MATCH_REASONS,
  type ClassifiedEmail,
  type ProposedChange,
} from "./types.ts";

const BATCH_DIRECTORY = "inbox";
const BATCH_HASHES_FILE = "inbox-batches.json";
const THREADS_FILE = "inbox-threads.json";
const LOCK_DIRECTORY = ".inbox";
const BATCH_VERSION = 1;

type Failure = {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string };
};

function fail(code: string, message: string): Failure {
  return { ok: false, error: { code, message } };
}

function requireDataDir(ctx: CommandContext): Result<DataDir> {
  if (ctx.dataDir === null) return fail("data-dir-not-found", "no data directory found");
  return { ok: true, value: ctx.dataDir };
}

function threadsOf(dir: DataDir): Map<string, string> {
  const map = new Map<string, string>();
  const file = path.join(dir.path, THREADS_FILE);
  if (!existsSync(file)) return map;
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isObject(parsed)) return map;
  for (const [threadId, key] of Object.entries(parsed)) {
    if (typeof key === "string") map.set(threadId, key);
  }
  return map;
}

function processedMessageIds(events: readonly HuntEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.kind === "email.classified") ids.add(event.messageId);
  }
  return ids;
}

function renderBatch(items: readonly ProposedChange[]): string {
  return `${JSON.stringify({ version: BATCH_VERSION, items }, null, 2)}\n`;
}

function uniqueByMessage(emails: readonly ClassifiedEmail[]): ClassifiedEmail[] {
  const seen = new Set<string>();
  const unique: ClassifiedEmail[] = [];
  for (const email of emails) {
    if (seen.has(email.messageId)) continue;
    seen.add(email.messageId);
    unique.push(email);
  }
  return unique;
}

export async function proposeBatch(
  ctx: CommandContext,
  emails: ClassifiedEmail[],
): Promise<Result<{ batchPath: string; hash: string; items: ProposedChange[] }>> {
  const located = requireDataDir(ctx);
  if (!located.ok) return located;
  const dir = located.value;
  try {
    const events = await readEvents(dir);
    const processed = processedMessageIds(events);
    const applications = applicationsFromEvents(events);
    const threads = threadsOf(dir);
    const items = uniqueByMessage(emails)
      .filter((email) => !processed.has(email.messageId))
      .map((email) => matchEmail(email, applications, threads));
    const content = renderBatch(items);
    const hash = approvalHash(content);
    const batchPath = path.join(dir.path, BATCH_DIRECTORY, `batch-${hash.slice(0, 16)}.json`);
    writeAtomic(batchPath, content);
    new IdempotencyMap(path.join(dir.path, BATCH_HASHES_FILE)).record(
      batchKey(dir.path, batchPath),
      hash,
    );
    return { ok: true, value: { batchPath, hash, items } };
  } catch (error) {
    return fail("inbox-propose-failed", errorMessage(error));
  }
}

function parseItem(value: unknown): ProposedChange | null {
  if (!isObject(value)) return null;
  const {
    messageId,
    threadId,
    classification,
    key,
    candidates,
    band,
    reason,
    confirmed,
    targetState,
  } = value;
  if (typeof messageId !== "string" || typeof threadId !== "string") return null;
  if (!isOneOf(EMAIL_CLASSES, classification)) return null;
  if (key !== null && typeof key !== "string") return null;
  if (!Array.isArray(candidates) || !candidates.every((entry) => typeof entry === "string"))
    return null;
  if (!isOneOf(MATCH_REASONS, reason)) return null;
  if (band !== "high" && band !== "medium" && band !== "none") return null;
  if (typeof reason !== "string" || typeof confirmed !== "boolean") return null;
  if (targetState !== null && !isOneOf(APPLICATION_STATES, targetState)) return null;
  return {
    messageId,
    threadId,
    classification,
    key,
    candidates,
    band,
    reason,
    confirmed,
    targetState,
  };
}

function parseBatch(content: string): ProposedChange[] | null {
  const parsed: unknown = JSON.parse(content);
  if (!isObject(parsed) || !Array.isArray(parsed["items"])) return null;
  const items: ProposedChange[] = [];
  for (const raw of parsed["items"]) {
    const item = parseItem(raw);
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

async function writeItem(
  dir: DataDir,
  item: ProposedChange,
  currentState: string | null,
): Promise<void> {
  if (item.key === null) return;
  await appendEvent(dir, {
    kind: "email.classified",
    key: item.key,
    messageId: item.messageId,
    classification: item.classification,
  });
  if (item.targetState !== null && item.targetState !== currentState) {
    await appendEvent(dir, { kind: "status.changed", key: item.key, to: item.targetState });
  }
}

async function projectKeys(
  ctx: CommandContext,
  dir: DataDir,
  keys: readonly string[],
): Promise<Result<void>> {
  if (keys.length === 0) return { ok: true, value: undefined };
  const profile = loadProfile(dir);
  if (!profile.ok) return profile;
  const events = (await readEvents(dir)).filter(
    (event) => event.key !== undefined && keys.includes(event.key),
  );
  const projected = await projectEvents(
    createTracker(profile.value.tracker, dir, { apiKey: ctx.env["LINEAR_API_KEY"] }),
    dir,
    events,
  );
  return projected.ok ? { ok: true, value: undefined } : projected;
}

function recordThreads(dir: DataDir, items: readonly ProposedChange[]): void {
  const map = new IdempotencyMap(path.join(dir.path, THREADS_FILE));
  for (const item of items) {
    if (item.key === null || map.lookup(item.threadId) !== null) continue;
    map.record(item.threadId, item.key);
  }
}

async function writeItems(
  dir: DataDir,
  items: readonly ProposedChange[],
  processed: Set<string>,
  states: Map<string, string | null>,
  applied: number,
): Promise<number> {
  const [item, ...rest] = items;
  if (item === undefined) return applied;
  if (processed.has(item.messageId) || item.key === null) {
    return writeItems(dir, rest, processed, states, applied);
  }
  await writeItem(dir, item, states.get(item.key) ?? null);
  processed.add(item.messageId);
  if (item.targetState !== null) states.set(item.key, item.targetState);
  return writeItems(dir, rest, processed, states, applied + 1);
}

async function applyItems(
  ctx: CommandContext,
  dir: DataDir,
  items: readonly ProposedChange[],
): Promise<Result<{ applied: number }>> {
  const confirmed = items.filter((item) => item.confirmed && item.key !== null);
  const events = await readEvents(dir);
  const processed = processedMessageIds(events);
  const states = new Map(
    applicationsFromEvents(events).map((record) => [record.key, record.state]),
  );
  const applied = await writeItems(dir, confirmed, processed, states, 0);
  recordThreads(dir, confirmed);
  const keys = [...new Set(confirmed.flatMap((item) => (item.key === null ? [] : [item.key])))];
  const projected = await projectKeys(ctx, dir, keys);
  if (!projected.ok) return projected;
  return { ok: true, value: { applied } };
}

export async function applyBatch(
  ctx: CommandContext,
  batchPath: string,
): Promise<Result<{ applied: number }>> {
  const located = requireDataDir(ctx);
  if (!located.ok) return located;
  const dir = located.value;
  const resolved = path.resolve(ctx.cwd, batchPath);
  try {
    if (!existsSync(resolved)) return fail("batch-not-found", `no batch file at ${resolved}`);
    const content = readFileSync(resolved, "utf8");
    const expected = lookupBatchHash(
      new IdempotencyMap(path.join(dir.path, BATCH_HASHES_FILE)),
      dir.path,
      resolved,
    );
    if (expected === null)
      return fail("batch-unknown", `${resolved} was not proposed by this data dir`);
    if (approvalHash(content) !== expected) {
      return fail("batch-changed", `${resolved} changed after it was proposed; propose again`);
    }
    const items = parseBatch(content);
    if (items === null) return fail("batch-malformed", `${resolved} is not a valid batch`);
    return await withLock(path.join(dir.path, LOCK_DIRECTORY), () => applyItems(ctx, dir, items));
  } catch (error) {
    return fail("inbox-apply-failed", errorMessage(error));
  }
}
