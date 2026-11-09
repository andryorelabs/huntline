import { readFileSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import type { DataDir } from "../core/types.ts";
import { GLOBAL_SCOPE, listAnswers, lookupAnswer, saveAnswer } from "./answers.ts";
import { listNeeds, recordBlocker, UNANSWERED_PREFIX } from "./blockers.ts";
import type { FieldDump, IntendedField } from "./types.ts";
import { verifyFields } from "./verify.ts";

const BLOCKER_SCOPES = ["field", "section", "application"] as const;

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function positionals(argv: readonly string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (token.startsWith("--")) {
      index += 1;
      continue;
    }
    values.push(token);
  }
  return values;
}

function usage(message: string): Envelope<never> {
  return failure("usage", message, { recoverable: false });
}

function readJsonArray(file: string, cwd: string): unknown[] {
  const parsed: unknown = JSON.parse(readFileSync(path.resolve(cwd, file), "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${file} must be a JSON array`);
  return parsed;
}

function toIntended(value: unknown): IntendedField | null {
  if (!isObject(value)) return null;
  const { name, kind, value: fieldValue } = value;
  if (typeof name !== "string" || typeof fieldValue !== "string") return null;
  if (kind !== undefined && !isOneOf(["text", "file"], kind)) return null;
  return { name, kind: kind === "file" ? "file" : "text", value: fieldValue };
}

function toDump(value: unknown): FieldDump | null {
  if (!isObject(value)) return null;
  const { name, value: fieldValue } = value;
  if (typeof name !== "string" || typeof fieldValue !== "string") return null;
  return { name, value: fieldValue };
}

function collect<Item>(rows: readonly unknown[], convert: (row: unknown) => Item | null): Item[] | null {
  const items: Item[] = [];
  for (const row of rows) {
    const item = convert(row);
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

async function runAnswer(argv: readonly string[], dir: DataDir): Promise<Envelope<unknown>> {
  if (argv.includes("--list")) return success({ answers: listAnswers(dir) });
  const question = positionals(argv).join(" ").trim();
  if (question === "") return usage("apply answer needs a question");
  const scope = flagValue(argv, "--scope") ?? GLOBAL_SCOPE;
  const text = flagValue(argv, "--save");
  if (text !== undefined) {
    const provenance = flagValue(argv, "--provenance");
    if (provenance === undefined) return usage("--save needs --provenance <source>");
    const saved = await saveAnswer(dir, question, scope, text, provenance);
    if (!saved.ok) return failure(saved.error.code, saved.error.message);
    return success({ status: "saved", scope, provenance });
  }
  const key = flagValue(argv, "--key");
  if (key === undefined) return usage("apply answer needs --key <lead key>");
  const result = lookupAnswer(dir, question, scope);
  if (result.status === "answer") return success(result);
  const event = await recordBlocker(dir, key, "field", `${UNANSWERED_PREFIX}${question}`);
  return success({ status: "abstain", blockerId: event.kind === "blocker.opened" ? event.blockerId : null });
}

function runVerify(argv: readonly string[], cwd: string): Envelope<unknown> {
  const intendedFile = flagValue(argv, "--intended");
  const dumpFile = flagValue(argv, "--dump");
  if (intendedFile === undefined || dumpFile === undefined) {
    return usage("apply verify needs --intended <file> and --dump <file>");
  }
  const intended = collect(readJsonArray(intendedFile, cwd), toIntended);
  const dump = collect(readJsonArray(dumpFile, cwd), toDump);
  if (intended === null || dump === null) {
    return usage("fields need a string name and a string value; intended kind is text or file");
  }
  const findings = verifyFields(intended, dump);
  if (findings.length === 0) return success({ verified: intended.length, findings });
  return failure("verify-mismatch", JSON.stringify(findings), {
    recoveryAction: "fix the listed fields in the form and verify again",
  });
}

async function runBlock(argv: readonly string[], dir: DataDir): Promise<Envelope<unknown>> {
  const [key] = positionals(argv);
  const scope = flagValue(argv, "--scope") ?? "field";
  const detail = flagValue(argv, "--detail");
  if (key === undefined) return usage("apply block needs a lead key");
  if (!isOneOf(BLOCKER_SCOPES, scope)) return usage("--scope must be field, section or application");
  if (detail === undefined || detail.trim() === "") return usage("apply block needs --detail <text>");
  const event = await recordBlocker(dir, key, scope, detail);
  return success({ blockerId: event.kind === "blocker.opened" ? event.blockerId : null, key, scope });
}

async function dispatchApply(
  argv: readonly string[],
  ctx: CommandContext,
): Promise<Envelope<unknown>> {
  const [sub, ...rest] = argv;
  if (sub === "verify") return runVerify(rest, ctx.cwd);
  const needsDataDir = sub === "answer" || sub === "block";
  if (!needsDataDir) return usage("usage: apply answer|verify|block");
  if (ctx.dataDir === null) {
    return failure("data-dir-not-found", "no data directory found", { recoverable: false });
  }
  return sub === "answer" ? runAnswer(rest, ctx.dataDir) : runBlock(rest, ctx.dataDir);
}

export async function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  try {
    const [command, ...rest] = argv;
    if (command === "needs") {
      if (ctx.dataDir === null) {
        return failure("data-dir-not-found", "no data directory found", { recoverable: false });
      }
      return success({ groups: await listNeeds(ctx.dataDir) });
    }
    if (command === "apply") return await dispatchApply(rest, ctx);
    return usage("usage: apply answer|verify|block, needs");
  } catch (error) {
    return failure("internal", errorMessage(error), { recoverable: false });
  }
}
