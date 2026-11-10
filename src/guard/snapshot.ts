import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { isObject } from "../core/narrow.ts";

const UID_LINE = /\buid=(\S+)\s+(.*)$/;

function snapshotDirectory(): string {
  return path.join(os.tmpdir(), "huntline-guard");
}

function snapshotFile(sessionId: string): string {
  return path.join(snapshotDirectory(), `${sessionId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}

function collectStrings(value: unknown, into: string[], depth = 0): void {
  if (depth > 8) return;
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const entry of value) collectStrings(entry, into, depth + 1);
  else if (isObject(value))
    for (const entry of Object.values(value)) collectStrings(entry, into, depth + 1);
}

export function parseSnapshotLabels(response: unknown): Record<string, string> {
  const strings: string[] = [];
  collectStrings(response, strings);
  const labels: Record<string, string> = {};
  for (const line of strings.join("\n").split("\n")) {
    const match = UID_LINE.exec(line);
    if (match === null) continue;
    const uid = match[1] ?? "";
    labels[uid] = match[2] ?? "";
  }
  return labels;
}

export function recordSnapshot(sessionId: string, labels: Record<string, string>): void {
  mkdirSync(snapshotDirectory(), { recursive: true });
  const target = snapshotFile(sessionId);
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(labels));
  renameSync(temporary, target);
}

export function lookupLabel(sessionId: string, uid: string): string | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(snapshotFile(sessionId), "utf8"));
    if (!isObject(parsed)) return null;
    const label = parsed[uid];
    return typeof label === "string" ? label : null;
  } catch {
    return null;
  }
}
