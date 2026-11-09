import { readFileSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import type { Posting, Result } from "../core/types.ts";
import { normalizeLiveness, recordScore } from "./score.ts";
import { ingestPostings, runSweep } from "./sweep.ts";
import type { ScoreInput } from "./types.ts";

const SWEEP_USAGE = "usage: huntline sweep [--source <name>]... [--keyword <text>]...";
const INGEST_USAGE =
  "usage: huntline ingest --source <label> (--file <postings.json> | --json <postings>)";
const SCORE_USAGE =
  "usage: huntline score <key> --score <0-100> [--reason <text>]... [--liveness live|closed|unknown] [--liveness-error <message>]";

type Flags = { readonly values: Map<string, string[]>; readonly positionals: string[] };

function parseFlags(argv: readonly string[]): Flags {
  const values = new Map<string, string[]>();
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const value = argv[index + 1] ?? "";
    values.set(token, [...(values.get(token) ?? []), value]);
    index += 1;
  }
  return { values, positionals };
}

function one(flags: Flags, name: string): string | undefined {
  return flags.values.get(name)?.at(-1);
}

function usage(message: string): Envelope<never> {
  return failure("usage", message, { recoverable: false });
}

function unwrap<T>(result: Result<T>): Envelope<T> {
  if (result.ok) return success(result.value);
  return failure(result.error.code, result.error.message);
}

function toPosting(value: unknown, index: number): Posting | string {
  if (!isObject(value)) return `posting ${index} must be an object`;
  const { id, url, company, title } = value;
  if (typeof id !== "string" || typeof url !== "string") return `posting ${index} needs string id and url`;
  if (typeof company !== "string" || typeof title !== "string") {
    return `posting ${index} needs string company and title`;
  }
  const source = typeof value["source"] === "string" ? value["source"] : "";
  const optional = optionalFields(value, index);
  if (typeof optional === "string") return optional;
  return { id, url, company, title, source, ...optional };
}

function optionalFields(value: Record<string, unknown>, index: number): Partial<Posting> | string {
  const result: Record<string, unknown> = {};
  for (const field of ["location", "contract", "description", "postedAt"] as const) {
    const entry = value[field];
    if (entry === undefined || entry === null) continue;
    if (typeof entry !== "string") return `posting ${index} field ${field} must be a string`;
    result[field] = entry;
  }
  const remote = value["remote"];
  if (remote !== undefined && remote !== null) {
    if (typeof remote !== "boolean") return `posting ${index} field remote must be a boolean`;
    result["remote"] = remote;
  }
  const stack = value["stack"];
  if (stack !== undefined && stack !== null) {
    if (!Array.isArray(stack) || stack.some((item) => typeof item !== "string")) {
      return `posting ${index} field stack must be an array of strings`;
    }
    result["stack"] = stack;
  }
  const salary = value["salary"];
  if (salary !== undefined && salary !== null) {
    if (!isObject(salary)) return `posting ${index} field salary must be an object`;
    const parsed: Record<string, unknown> = {};
    for (const bound of ["min", "max"] as const) {
      const amount = salary[bound];
      if (amount === undefined || amount === null) continue;
      if (typeof amount !== "number" || !Number.isFinite(amount)) return `posting ${index} salary ${bound} must be a number`;
      parsed[bound] = amount;
    }
    if (typeof salary["currency"] === "string") parsed["currency"] = salary["currency"];
    if (salary["period"] === "year" || salary["period"] === "month") parsed["period"] = salary["period"];
    result["salary"] = parsed;
  }
  return result as Partial<Posting>;
}

function parsePostings(raw: unknown): Posting[] | string {
  const list = isObject(raw) ? raw["postings"] : raw;
  if (!Array.isArray(list)) return "expected a JSON array of postings or an object with a postings array";
  const postings: Posting[] = [];
  for (const [index, entry] of list.entries()) {
    const posting = toPosting(entry, index);
    if (typeof posting === "string") return posting;
    postings.push(posting);
  }
  return postings;
}

function readPayload(flags: Flags, cwd: string): { raw: unknown } | { problem: string } {
  const inline = one(flags, "--json");
  const file = one(flags, "--file");
  if ((inline === undefined) === (file === undefined)) return { problem: INGEST_USAGE };
  try {
    const text = inline ?? readFileSync(path.resolve(cwd, file ?? ""), "utf8");
    return { raw: JSON.parse(text) };
  } catch (error) {
    return { problem: `could not read postings JSON: ${errorMessage(error)}` };
  }
}

async function sweepCommand(argv: readonly string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const flags = parseFlags(argv);
  if (flags.positionals.length > 0) return usage(SWEEP_USAGE);
  const only = flags.values.get("--source");
  const keywords = flags.values.get("--keyword");
  return unwrap(
    await runSweep(ctx, {
      ...(only === undefined ? {} : { only }),
      ...(keywords === undefined ? {} : { keywords }),
    }),
  );
}

async function ingestCommand(argv: readonly string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const flags = parseFlags(argv);
  const source = one(flags, "--source");
  if (source === undefined || source.trim() === "" || flags.positionals.length > 0) {
    return usage(INGEST_USAGE);
  }
  const payload = readPayload(flags, ctx.cwd);
  if ("problem" in payload) return usage(payload.problem);
  const postings = parsePostings(payload.raw);
  if (typeof postings === "string") return usage(postings);
  return unwrap(await ingestPostings(ctx, postings, source));
}

function toScoreInput(flags: Flags): ScoreInput | string {
  const rawScore = one(flags, "--score");
  if (rawScore === undefined || rawScore.trim() === "") return SCORE_USAGE;
  const liveness = one(flags, "--liveness");
  const livenessError = one(flags, "--liveness-error");
  return {
    score: Number(rawScore),
    reasons: flags.values.get("--reason") ?? [],
    ...(liveness === undefined ? {} : { liveness }),
    ...(livenessError === undefined ? {} : { livenessError }),
  };
}

async function scoreCommand(argv: readonly string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const flags = parseFlags(argv);
  const [key] = flags.positionals;
  if (key === undefined || flags.positionals.length !== 1) return usage(SCORE_USAGE);
  const input = toScoreInput(flags);
  if (typeof input === "string") return usage(input);
  const recorded = await recordScore(ctx, key, input);
  if (!recorded.ok) return failure(recorded.error.code, recorded.error.message);
  return success({
    key,
    score: input.score,
    reasons: input.reasons,
    liveness: normalizeLiveness(input),
  });
}

export async function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [command, ...rest] = argv;
  if (command === "sweep") return sweepCommand(rest, ctx);
  if (command === "ingest") return ingestCommand(rest, ctx);
  if (command === "score") return scoreCommand(rest, ctx);
  return usage(`unknown command "${command ?? ""}"`);
}
