import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { listAnswers, type StoredAnswer } from "../apply/answers.ts";
import { approvalHash, IdempotencyMap } from "../core/approval.ts";
import type { CommandContext } from "../core/commands.ts";
import { withLock, writeAtomic } from "../core/fs.ts";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import type { DataDir, Result } from "../core/types.ts";
import { loadBullets, loadFactBank, loadNeverClaim } from "../cv/facts.ts";
import type { Bullet } from "../cv/types.ts";
import { DOSSIER_SOURCES } from "./dossier.ts";
import { validateProposal, type DossierProposal, type FactProposal } from "./proposal.ts";

const DERIVED_FILES = [
  "facts.yaml",
  "bullets.yaml",
  "profile.yaml",
  "never-claim.yaml",
  "answers.json",
] as const;
type DerivedFile = (typeof DERIVED_FILES)[number];

const OPERATIONS = ["add", "update", "remove"] as const;
type Operation = (typeof OPERATIONS)[number];

/** One difference between a proposal and the current derived files. */
type DerivedChange = {
  readonly file: DerivedFile;
  readonly op: Operation;
  readonly id: string;
  readonly value: unknown;
};

const BATCH_DIRECTORY = "dossier/batches";
const BATCH_HASHES_FILE = "dossier-batches.json";
const LOCK_DIRECTORY = ".dossier";
const BATCH_VERSION = 1;

function fail(
  code: string,
  message: string,
): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code, message } };
}

function readYamlMapping(dir: DataDir, file: string): Record<string, unknown> {
  const target = path.join(dir.path, file);
  if (!existsSync(target)) return {};
  const parsed: unknown = Bun.YAML.parse(readFileSync(target, "utf8"));
  return isObject(parsed) ? parsed : {};
}

function rowsOf(document: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const list = document[key];
  return Array.isArray(list) ? list.filter(isObject) : [];
}

function canonical(value: unknown): string {
  return JSON.stringify(value);
}

function bulletRow(bullet: Bullet): Record<string, unknown> {
  return {
    id: bullet.id,
    text: bullet.text,
    tags: bullet.tags,
    facts: bullet.factIds,
    ...(bullet.entry === undefined ? {} : { entry: bullet.entry }),
    ...(bullet.order === undefined ? {} : { order: bullet.order }),
  };
}

function storedFactRow(row: Record<string, unknown>): string {
  const tags = Array.isArray(row["tags"]) ? row["tags"] : [];
  const cites = Array.isArray(row["cites"]) ? row["cites"] : [];
  return canonical([row["id"], row["text"], tags, row["source"] ?? null, cites]);
}

function proposedFactRow(fact: FactProposal): string {
  return canonical([fact.id, fact.text, fact.tags, fact.source, fact.cites]);
}

function bulletKey(bullet: Bullet): string {
  return canonical([
    bullet.id,
    bullet.text,
    bullet.tags,
    bullet.factIds,
    bullet.entry ?? null,
    bullet.order ?? null,
  ]);
}

function answerSlot(answer: { answerKey: string; scope: string }): string {
  return `${answer.answerKey}|${answer.scope}`;
}

function diffFacts(dir: DataDir, proposal: DossierProposal): DerivedChange[] {
  const stored = new Map(
    rowsOf(readYamlMapping(dir, "facts.yaml"), "facts").map((row) => [row["id"], row]),
  );
  const changes: DerivedChange[] = [];
  for (const fact of proposal.facts) {
    const current = stored.get(fact.id);
    if (current === undefined)
      changes.push({ file: "facts.yaml", op: "add", id: fact.id, value: fact });
    else if (storedFactRow(current) !== proposedFactRow(fact)) {
      changes.push({ file: "facts.yaml", op: "update", id: fact.id, value: fact });
    }
  }
  for (const id of proposal.removals?.facts ?? []) {
    if (stored.has(id)) changes.push({ file: "facts.yaml", op: "remove", id, value: null });
  }
  return changes;
}

function diffBullets(proposal: DossierProposal, current: Bullet[]): DerivedChange[] {
  const stored = new Map(current.map((bullet) => [bullet.id, bullet]));
  const changes: DerivedChange[] = [];
  for (const bullet of proposal.bullets) {
    const existing = stored.get(bullet.id);
    if (existing === undefined)
      changes.push({ file: "bullets.yaml", op: "add", id: bullet.id, value: bullet });
    else if (bulletKey(existing) !== bulletKey(bullet)) {
      changes.push({ file: "bullets.yaml", op: "update", id: bullet.id, value: bullet });
    }
  }
  for (const id of proposal.removals?.bullets ?? []) {
    if (stored.has(id)) changes.push({ file: "bullets.yaml", op: "remove", id, value: null });
  }
  return changes;
}

function diffProfile(dir: DataDir, proposal: DossierProposal): DerivedChange[] {
  const current = readYamlMapping(dir, "profile.yaml");
  return Object.entries(proposal.profile).flatMap<DerivedChange>(([key, value]) => {
    if (!Object.hasOwn(current, key))
      return [{ file: "profile.yaml" as const, op: "add" as const, id: key, value }];
    if (canonical(current[key]) === canonical(value)) return [];
    return [{ file: "profile.yaml" as const, op: "update" as const, id: key, value }];
  });
}

function diffNeverClaim(proposal: DossierProposal, current: string[]): DerivedChange[] {
  return [...new Set(proposal.neverClaim)]
    .filter((term) => !current.includes(term))
    .map((term) => ({
      file: "never-claim.yaml" as const,
      op: "add" as const,
      id: term,
      value: term,
    }));
}

function diffAnswers(proposal: DossierProposal, current: StoredAnswer[]): DerivedChange[] {
  const stored = new Map(current.map((answer) => [answerSlot(answer), answer]));
  return proposal.answers.flatMap<DerivedChange>((answer) => {
    const existing = stored.get(answerSlot(answer));
    const id = answerSlot(answer);
    if (existing === undefined)
      return [{ file: "answers.json" as const, op: "add" as const, id, value: answer }];
    if (existing.text === answer.text && existing.provenance === answer.provenance) return [];
    return [{ file: "answers.json" as const, op: "update" as const, id, value: answer }];
  });
}

function renderBatch(items: readonly DerivedChange[]): string {
  return `${JSON.stringify({ version: BATCH_VERSION, items }, null, 2)}\n`;
}

function currentFactIds(dir: DataDir): Result<string[]> {
  if (!existsSync(path.join(dir.path, "facts.yaml"))) return { ok: true, value: [] };
  const bank = loadFactBank(dir);
  return bank.ok ? { ok: true, value: bank.value.facts.map((fact) => fact.id) } : bank;
}

function currentBullets(dir: DataDir): Result<Bullet[]> {
  return existsSync(path.join(dir.path, "bullets.yaml"))
    ? loadBullets(dir)
    : { ok: true, value: [] };
}

function currentNeverClaim(dir: DataDir): Result<string[]> {
  return existsSync(path.join(dir.path, "never-claim.yaml"))
    ? loadNeverClaim(dir)
    : { ok: true, value: [] };
}

function requireDataDir(ctx: CommandContext): Result<DataDir> {
  if (ctx.dataDir === null) return fail("data-dir-not-found", "no data directory found");
  return { ok: true, value: ctx.dataDir };
}

/**
 * Validates `proposal`, diffs it against the current derived files and writes an
 * Approval batch holding only the differences. Facts and bullets the proposal does not
 * mention are kept; they are removed only when listed in `removals`.
 */
export function deriveBatch(
  ctx: CommandContext,
  proposal: DossierProposal,
): Promise<Result<DerivedBatch>> {
  return Promise.resolve(deriveSync(ctx, proposal));
}

type DerivedBatch = { batchPath: string; hash: string; items: DerivedChange[] };

function deriveSync(ctx: CommandContext, proposal: DossierProposal): Result<DerivedBatch> {
  const located = requireDataDir(ctx);
  if (!located.ok) return located;
  const dir = located.value;
  try {
    const factIds = currentFactIds(dir);
    if (!factIds.ok) return factIds;
    const bullets = currentBullets(dir);
    if (!bullets.ok) return bullets;
    const neverClaim = currentNeverClaim(dir);
    if (!neverClaim.ok) return neverClaim;
    const valid = validateProposal(dir, proposal, factIds.value, bullets.value);
    if (!valid.ok) return valid;
    const items = [
      ...diffFacts(dir, proposal),
      ...diffBullets(proposal, bullets.value),
      ...diffProfile(dir, proposal),
      ...diffNeverClaim(proposal, neverClaim.value),
      ...diffAnswers(proposal, listAnswers(dir)),
    ];
    const content = renderBatch(items);
    const hash = approvalHash(content);
    const batchPath = path.join(dir.path, BATCH_DIRECTORY, `batch-${hash.slice(0, 16)}.json`);
    writeAtomic(batchPath, content);
    new IdempotencyMap(path.join(dir.path, BATCH_HASHES_FILE)).record(batchPath, hash);
    return { ok: true, value: { batchPath, hash, items } };
  } catch (error) {
    return fail("dossier-derive-failed", errorMessage(error));
  }
}

function parseChange(value: unknown): DerivedChange | null {
  if (!isObject(value)) return null;
  const { file, op, id } = value;
  if (!isOneOf(DERIVED_FILES, file) || !isOneOf(OPERATIONS, op) || typeof id !== "string")
    return null;
  return { file, op, id, value: value["value"] };
}

function parseBatch(content: string): DerivedChange[] | null {
  const parsed: unknown = JSON.parse(content);
  if (!isObject(parsed) || !Array.isArray(parsed["items"])) return null;
  const items: DerivedChange[] = [];
  for (const raw of parsed["items"]) {
    const item = parseChange(raw);
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

type Rendered = { readonly content: string; readonly applied: number };

function upsertRow(
  rows: Record<string, unknown>[],
  change: DerivedChange,
  row: Record<string, unknown>,
): boolean {
  const index = rows.findIndex((existing) => existing["id"] === change.id);
  if (change.op === "remove") {
    if (index === -1) return false;
    rows.splice(index, 1);
    return true;
  }
  if (index === -1) {
    rows.push(row);
    return true;
  }
  const merged = { ...rows[index], ...row };
  if (canonical(merged) === canonical(rows[index])) return false;
  rows[index] = merged;
  return true;
}

function renderYaml(document: Record<string, unknown>): string {
  return `${Bun.YAML.stringify(document, null, 2)}\n`;
}

function renderRowFile(
  dir: DataDir,
  file: "facts.yaml" | "bullets.yaml",
  key: "facts" | "bullets",
  changes: readonly DerivedChange[],
  toRow: (value: unknown) => Record<string, unknown>,
): Rendered {
  const document = readYamlMapping(dir, file);
  const rows = rowsOf(document, key);
  let applied = 0;
  for (const change of changes) {
    if (upsertRow(rows, change, change.op === "remove" ? {} : toRow(change.value))) applied += 1;
  }
  return { content: renderYaml({ ...document, [key]: rows }), applied };
}

function renderProfile(dir: DataDir, changes: readonly DerivedChange[]): Rendered {
  const document = readYamlMapping(dir, "profile.yaml");
  let applied = 0;
  for (const change of changes) {
    if (canonical(document[change.id]) === canonical(change.value)) continue;
    document[change.id] = change.value;
    applied += 1;
  }
  return { content: renderYaml(document), applied };
}

function renderNeverClaim(dir: DataDir, changes: readonly DerivedChange[]): Rendered {
  const document = readYamlMapping(dir, "never-claim.yaml");
  const terms = Array.isArray(document["terms"]) ? Array.from<unknown>(document["terms"]) : [];
  let applied = 0;
  for (const change of changes) {
    if (terms.includes(change.id)) continue;
    terms.push(change.id);
    applied += 1;
  }
  return { content: renderYaml({ ...document, terms }), applied };
}

function toStoredAnswer(value: unknown): StoredAnswer {
  if (!isObject(value)) throw new TypeError("answer item is not an object");
  const { answerKey, scope, text, provenance } = value;
  if (
    typeof answerKey !== "string" ||
    typeof scope !== "string" ||
    typeof text !== "string" ||
    typeof provenance !== "string"
  ) {
    throw new TypeError("answer item is malformed");
  }
  return { answerKey, scope, text, provenance };
}

function renderAnswers(dir: DataDir, changes: readonly DerivedChange[]): Rendered {
  const rows = listAnswers(dir);
  let applied = 0;
  for (const change of changes) {
    const answer = toStoredAnswer(change.value);
    const index = rows.findIndex((row) => answerSlot(row) === answerSlot(answer));
    if (index === -1) rows.push(answer);
    else if (canonical(rows[index]) === canonical(answer)) continue;
    else rows[index] = answer;
    applied += 1;
  }
  return { content: `${JSON.stringify(rows, null, 2)}\n`, applied };
}

function toFactRow(value: unknown): Record<string, unknown> {
  if (
    !isObject(value) ||
    !Array.isArray(value["cites"]) ||
    !isOneOf(DOSSIER_SOURCES, value["source"])
  ) {
    throw new TypeError("fact item is malformed");
  }
  return {
    id: value["id"],
    text: value["text"],
    tags: value["tags"],
    source: value["source"],
    cites: value["cites"],
  };
}

function toBulletRow(value: unknown): Record<string, unknown> {
  if (!isObject(value) || typeof value["id"] !== "string" || !Array.isArray(value["factIds"])) {
    throw new TypeError("bullet item is malformed");
  }
  return bulletRow({
    id: value["id"],
    text: String(value["text"]),
    tags: Array.isArray(value["tags"]) ? value["tags"].map(String) : [],
    factIds: value["factIds"].map(String),
    ...(typeof value["entry"] === "string" ? { entry: value["entry"] } : {}),
    ...(typeof value["order"] === "number" ? { order: value["order"] } : {}),
  });
}

function renderAll(dir: DataDir, items: readonly DerivedChange[]): Map<DerivedFile, Rendered> {
  const rendered = new Map<DerivedFile, Rendered>();
  for (const file of DERIVED_FILES) {
    const changes = items.filter((item) => item.file === file);
    if (changes.length === 0) continue;
    if (file === "facts.yaml")
      rendered.set(file, renderRowFile(dir, file, "facts", changes, toFactRow));
    else if (file === "bullets.yaml")
      rendered.set(file, renderRowFile(dir, file, "bullets", changes, toBulletRow));
    else if (file === "profile.yaml") rendered.set(file, renderProfile(dir, changes));
    else if (file === "never-claim.yaml") rendered.set(file, renderNeverClaim(dir, changes));
    else rendered.set(file, renderAnswers(dir, changes));
  }
  return rendered;
}

function applyItems(dir: DataDir, items: readonly DerivedChange[]): Result<{ applied: number }> {
  const rendered = renderAll(dir, items);
  let applied = 0;
  for (const [file, output] of rendered) {
    if (output.applied === 0) continue;
    writeAtomic(path.join(dir.path, file), output.content);
    applied += output.applied;
  }
  return { ok: true, value: { applied } };
}

/**
 * Applies an Approval batch under a lock. An edited batch fails `batch-changed` before
 * any derived file is touched; applying an already applied batch changes nothing.
 */
export async function applyDossierBatch(
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
    const expected = new IdempotencyMap(path.join(dir.path, BATCH_HASHES_FILE)).lookup(resolved);
    if (expected === null)
      return fail("batch-changed", `${resolved} was not derived by this data dir`);
    if (approvalHash(content) !== expected) {
      return fail("batch-changed", `${resolved} changed after it was derived; derive again`);
    }
    const items = parseBatch(content);
    if (items === null) return fail("batch-changed", `${resolved} is not a valid batch`);
    return await withLock(path.join(dir.path, LOCK_DIRECTORY), () =>
      Promise.resolve(applyItems(dir, items)),
    );
  } catch (error) {
    return fail("dossier-apply-failed", errorMessage(error));
  }
}
