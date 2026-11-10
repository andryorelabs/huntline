import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import {
  APPLICATION_STATES,
  ELIGIBILITIES,
  REJECTION_REASONS,
  type DataDir,
  type Posting,
} from "../core/types.ts";
import { loadProfile } from "../core/data-dir.ts";
import { createTracker, projectEvents } from "../tracker/index.ts";
import { findDuplicate, readLedger } from "./dedup.ts";
import { appendEvent, readEvents, type NewEvent } from "./events.ts";
import { foldState } from "./state.ts";

const EVENT_KINDS = [
  "posting.seen",
  "posting.dismissed",
  "lead.created",
  "score.recorded",
  "status.changed",
  "blocker.opened",
  "blocker.resolved",
  "cv.built",
  "email.classified",
  "outreach.logged",
  "note",
] as const;

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function usage(message: string): Envelope<never> {
  return failure("usage", message, { recoverable: false });
}

function parseJsonFlag(argv: readonly string[]): { value: unknown } | Envelope<never> {
  const raw = flagValue(argv, "--json");
  if (raw === undefined) return usage("--json <payload> is required");
  try {
    return { value: JSON.parse(raw) };
  } catch (error) {
    return usage(`--json is not valid JSON: ${errorMessage(error)}`);
  }
}

function isFailure(value: { value: unknown } | Envelope<never>): value is Envelope<never> {
  return "ok" in value;
}

function hasStrings(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

function hasPayload(value: Record<string, unknown>): boolean {
  switch (value["kind"]) {
    case "posting.seen":
    case "lead.created":
      return isPostingInput(value["posting"]) && isOneOf(ELIGIBILITIES, value["eligibility"]);
    case "posting.dismissed":
      return isPostingInput(value["posting"]) && isOneOf(REJECTION_REASONS, value["reason"]);
    case "score.recorded":
      return (
        typeof value["score"] === "number" &&
        Array.isArray(value["reasons"]) &&
        value["reasons"].every((reason) => typeof reason === "string") &&
        typeof value["liveness"] === "string"
      );
    case "status.changed":
      return (
        isOneOf(APPLICATION_STATES, value["to"]) &&
        (value["from"] === undefined || isOneOf(APPLICATION_STATES, value["from"]))
      );
    case "blocker.opened":
      return hasStrings(value, ["blockerId", "scope", "detail"]);
    case "blocker.resolved":
      return hasStrings(value, ["blockerId"]);
    case "cv.built":
      return hasStrings(value, ["variant", "path", "hash"]);
    case "email.classified":
      return hasStrings(value, ["messageId", "classification"]);
    case "outreach.logged":
      return hasStrings(value, ["channel", "recipient"]);
    case "note":
      return hasStrings(value, ["text"]);
    default:
      return false;
  }
}

function isNewEvent(value: unknown): value is NewEvent {
  if (!isObject(value) || !isOneOf(EVENT_KINDS, value["kind"])) return false;
  if ("id" in value || "at" in value) return false;
  if (value["key"] !== undefined && typeof value["key"] !== "string") return false;
  return hasPayload(value);
}

function isPostingInput(value: unknown): value is Posting {
  return (
    isObject(value) &&
    typeof value["id"] === "string" &&
    typeof value["source"] === "string" &&
    typeof value["company"] === "string" &&
    typeof value["title"] === "string"
  );
}

async function eventsCommand(argv: string[], dir: DataDir): Promise<Envelope<unknown>> {
  const [action, ...rest] = argv;
  if (action === "append") {
    const parsed = parseJsonFlag(rest);
    if (isFailure(parsed)) return parsed;
    if (!isNewEvent(parsed.value)) {
      return usage(
        `event needs a "kind" of ${EVENT_KINDS.join(", ")}, its required fields, and no id or at`,
      );
    }
    return success(await appendEvent(dir, parsed.value));
  }
  if (action === "list") {
    const events = await readEvents(dir, flagValue(rest, "--key"));
    return success({ count: events.length, events });
  }
  return usage("usage: events append --json <event> | events list [--key <key>]");
}

async function ledgerCommand(argv: string[], dir: DataDir): Promise<Envelope<unknown>> {
  const [action, ...rest] = argv;
  if (action === "list") {
    const entries = await readLedger(dir);
    return success({ count: entries.length, entries });
  }
  if (action === "check") {
    const parsed = parseJsonFlag(rest);
    if (isFailure(parsed)) return parsed;
    if (!isPostingInput(parsed.value)) {
      return usage("posting needs string id, source, company and title");
    }
    const match = await findDuplicate(dir, parsed.value);
    return success({ duplicate: match !== null, match });
  }
  return usage("usage: ledger list | ledger check --json <posting>");
}

async function setStatus(
  key: string,
  target: string,
  ctx: CommandContext,
  dir: DataDir,
): Promise<Envelope<unknown>> {
  if (!isOneOf(APPLICATION_STATES, target)) {
    return usage(`unknown state "${target}"; valid states: ${APPLICATION_STATES.join(", ")}`);
  }
  const current = foldState(await readEvents(dir, key));
  if (current === null) {
    return failure("not-found", `no events for key ${key}`, { recoverable: false });
  }
  await appendEvent(dir, { kind: "status.changed", key, from: current, to: target });
  const profile = loadProfile(dir);
  if (!profile.ok) return failure(profile.error.code, profile.error.message);
  const projected = await projectEvents(
    createTracker(profile.value.tracker, dir, { apiKey: ctx.env["LINEAR_API_KEY"] }),
    dir,
    await readEvents(dir, key),
  );
  if (!projected.ok) return failure(projected.error.code, projected.error.message);
  return success({ key, from: current, to: target });
}

async function statusCommand(
  argv: string[],
  ctx: CommandContext,
  dir: DataDir,
): Promise<Envelope<unknown>> {
  const [key] = argv;
  if (key === undefined || key.startsWith("--"))
    return usage("usage: status <key> [--set <state>]");
  const target = flagValue(argv, "--set");
  if (argv.includes("--set") && target === undefined) return usage("--set needs a state");
  if (target !== undefined) return setStatus(key, target, ctx, dir);
  const state = foldState(await readEvents(dir, key));
  if (state === null) {
    return failure("not-found", `no events for key ${key}`, { recoverable: false });
  }
  return success({ key, state });
}

export async function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  if (ctx.dataDir === null) {
    return failure("data-dir-not-found", "no data dir resolved; pass --data or set HUNTLINE_HOME");
  }
  const [command, ...rest] = argv;
  if (command === "events") return eventsCommand(rest, ctx.dataDir);
  if (command === "ledger") return ledgerCommand(rest, ctx.dataDir);
  if (command === "status") return statusCommand(rest, ctx, ctx.dataDir);
  return usage(`unknown command "${command ?? ""}"`);
}
