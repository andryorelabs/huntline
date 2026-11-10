import path from "node:path";
import { IdempotencyMap } from "../core/approval.ts";
import { withLock } from "../core/fs.ts";
import { errorMessage } from "../core/narrow.ts";
import type { DataDir, HuntEvent, Lead, Profile, Result, TrackerAdapter } from "../core/types.ts";
import {
  createLinearTracker,
  DEFAULT_LINEAR_MAPPING,
  type FetchLike,
  type LinearMapping,
} from "./linear.ts";
import { createLocalTracker } from "./local.ts";

const LEAD_MAP_FILE = "tracker-leads.json";
const EVENT_MAP_FILE = "tracker-events.json";
const LOCK_DIRECTORY = ".tracker";

export type TrackerEnvironment = {
  readonly apiKey?: string | undefined;
  readonly fetch?: FetchLike;
};

function mappingFor(config: Profile["tracker"]): LinearMapping {
  return {
    states: { ...DEFAULT_LINEAR_MAPPING.states, ...config.states },
    channelLabelPrefix: config.channelLabelPrefix ?? DEFAULT_LINEAR_MAPPING.channelLabelPrefix,
    channelLabels: config.channelLabels ?? {},
  };
}

export function createTracker(
  config: Profile["tracker"],
  dir: DataDir,
  environment: TrackerEnvironment = {},
): TrackerAdapter {
  if (config.kind === "local") return createLocalTracker(config.directory, dir);
  return createLinearTracker({
    apiKey: "apiKey" in environment ? environment.apiKey : process.env["LINEAR_API_KEY"],
    team: config.team,
    mapping: mappingFor(config),
    ...(config.titleFormat === undefined ? {} : { titleFormat: config.titleFormat }),
    idempotency: new IdempotencyMap(path.join(dir.path, LEAD_MAP_FILE)),
    ...(environment.fetch === undefined ? {} : { fetch: environment.fetch }),
  });
}

function describeEvent(event: HuntEvent): string | null {
  switch (event.kind) {
    case "score.recorded":
      return `score ${event.score} (${event.liveness}): ${event.reasons.join("; ")}`;
    case "blocker.opened":
      return `blocker opened ${event.blockerId} [${event.scope}]: ${event.detail}`;
    case "blocker.resolved":
      return `blocker resolved ${event.blockerId}`;
    case "cv.built":
      return `cv built ${event.variant} ${event.hash}`;
    case "email.classified":
      return `email ${event.messageId} classified ${event.classification}`;
    case "outreach.logged":
      return `outreach via ${event.channel} to ${event.recipient}`;
    case "note":
      return `note: ${event.text}`;
    case "lead.created":
    case "posting.dismissed":
    case "posting.seen":
    case "status.changed":
      break;
  }
  return null;
}

function groupByKey(events: readonly HuntEvent[]): Map<string, HuntEvent[]> {
  const groups = new Map<string, HuntEvent[]>();
  for (const event of events) {
    if (event.key === undefined) continue;
    groups.set(event.key, [...(groups.get(event.key) ?? []), event]);
  }
  return groups;
}

async function projectEvent(
  tracker: TrackerAdapter,
  eventMap: IdempotencyMap,
  key: string,
  event: HuntEvent,
): Promise<Result<boolean>> {
  const mark = `${key}:${event.id}`;
  if (eventMap.lookup(mark) !== null) return { ok: true, value: false };
  const text = describeEvent(event);
  let applied: Result<void>;
  if (event.kind === "status.changed") applied = await tracker.setStatus(key, event.to);
  else if (text !== null) applied = await tracker.comment(key, text);
  else return { ok: true, value: false };
  if (!applied.ok) return applied;
  eventMap.record(mark, "projected");
  return { ok: true, value: true };
}

async function projectEventsFrom(
  tracker: TrackerAdapter,
  eventMap: IdempotencyMap,
  key: string,
  events: readonly HuntEvent[],
  updated: boolean,
): Promise<Result<boolean>> {
  const [head, ...rest] = events;
  if (head === undefined) return { ok: true, value: updated };
  const projected = await projectEvent(tracker, eventMap, key, head);
  if (!projected.ok) return projected;
  return projectEventsFrom(tracker, eventMap, key, rest, updated || projected.value);
}

async function projectKey(
  tracker: TrackerAdapter,
  eventMap: IdempotencyMap,
  key: string,
  events: readonly HuntEvent[],
): Promise<Result<{ created: boolean; updated: boolean }>> {
  const seed = events.find((event) => event.kind === "lead.created");
  if (seed === undefined || seed.kind !== "lead.created") {
    return { ok: true, value: { created: false, updated: false } };
  }
  const lead: Lead = { key, posting: seed.posting, eligibility: seed.eligibility };
  const existing = await tracker.find(key);
  if (!existing.ok) return existing;
  const upserted = await tracker.upsertLead(lead);
  if (!upserted.ok) return upserted;
  const updated = await projectEventsFrom(tracker, eventMap, key, events, false);
  if (!updated.ok) return updated;
  return { ok: true, value: { created: existing.value === null, updated: updated.value } };
}

type Totals = { readonly created: number; readonly updated: number };

async function projectGroups(
  tracker: TrackerAdapter,
  eventMap: IdempotencyMap,
  groups: readonly (readonly [string, HuntEvent[]])[],
  totals: Totals,
): Promise<Result<Totals>> {
  const [head, ...rest] = groups;
  if (head === undefined) return { ok: true, value: totals };
  const projected = await projectKey(tracker, eventMap, head[0], head[1]);
  if (!projected.ok) return projected;
  const next: Totals = projected.value.created
    ? { ...totals, created: totals.created + 1 }
    : projected.value.updated
      ? { ...totals, updated: totals.updated + 1 }
      : totals;
  return projectGroups(tracker, eventMap, rest, next);
}

export async function projectEvents(
  tracker: TrackerAdapter,
  dir: DataDir,
  events: HuntEvent[],
): Promise<Result<{ created: number; updated: number }>> {
  try {
    return await withLock(path.join(dir.path, LOCK_DIRECTORY), () =>
      projectGroups(
        tracker,
        new IdempotencyMap(path.join(dir.path, EVENT_MAP_FILE)),
        [...groupByKey(events)],
        { created: 0, updated: 0 },
      ),
    );
  } catch (error) {
    return {
      ok: false,
      error: { code: "tracker-projection-failed", message: errorMessage(error) },
    };
  }
}
