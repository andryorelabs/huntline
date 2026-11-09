import { randomUUID } from "node:crypto";
import { appendEvent, readEvents } from "../ledger/events.ts";
import type { DataDir, HuntEvent } from "../core/types.ts";
import type { NeedsGroup, NeedsItem } from "./types.ts";

type BlockerScope = "field" | "section" | "application";

const SCOPE_ORDER: readonly BlockerScope[] = ["application", "section", "field"];

export function recordBlocker(
  dir: DataDir,
  key: string,
  scope: BlockerScope,
  detail: string,
): Promise<HuntEvent> {
  return appendEvent(dir, {
    kind: "blocker.opened",
    key,
    blockerId: randomUUID(),
    scope,
    detail,
  });
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
  return groups.values().toArray().toSorted(
    (left, right) =>
      left.key.localeCompare(right.key) ||
      SCOPE_ORDER.indexOf(left.scope) - SCOPE_ORDER.indexOf(right.scope),
  );
}
