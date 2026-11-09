import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { withLock } from "../core/fs.ts";
import { isObject } from "../core/narrow.ts";
import type { DataDir, HuntEvent } from "../core/types.ts";

export const EVENTS_FILE = "events.jsonl";

type DistributiveOmit<Union, Keys extends string> = Union extends unknown
  ? Omit<Union, Keys>
  : never;

export type NewEvent = DistributiveOmit<HuntEvent, "id" | "at">;

export function eventsPath(dir: DataDir): string {
  return path.join(dir.path, EVENTS_FILE);
}

export function readJsonLines(file: string): unknown[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): unknown => JSON.parse(line));
}

function isHuntEvent(value: unknown): value is HuntEvent {
  return isObject(value) && typeof value["kind"] === "string" && typeof value["id"] === "string";
}

export async function appendEvent(dir: DataDir, event: NewEvent): Promise<HuntEvent> {
  const stored = { ...event, id: randomUUID(), at: new Date().toISOString() } as HuntEvent;
  await withLock(dir.path, () => {
    mkdirSync(dir.path, { recursive: true });
    appendFileSync(eventsPath(dir), `${JSON.stringify(stored)}\n`);
    return Promise.resolve();
  });
  return stored;
}

export async function readEvents(dir: DataDir, key?: string): Promise<HuntEvent[]> {
  const lines = await withLock(dir.path, () => Promise.resolve(readJsonLines(eventsPath(dir))));
  const events = lines.filter(isHuntEvent);
  return key === undefined ? events : events.filter((event) => event.key === key);
}
