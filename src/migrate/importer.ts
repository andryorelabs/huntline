import path from "node:path";
import { IdempotencyMap } from "../core/approval.ts";
import { withLock } from "../core/fs.ts";
import { errorMessage } from "../core/narrow.ts";
import type { ApplicationState, DataDir, Posting } from "../core/types.ts";
import { dedupKey, ledgerRecord } from "../ledger/dedup.ts";
import { appendEvent, readEvents, type NewEvent } from "../ledger/events.ts";
import type { ImportResult } from "./types.ts";

const LOCK_DIRECTORY = ".migrate";

export type Importer = {
  lead(posting: Posting, preferredKey?: string): string;
  hadLead(key: string): boolean;
  existingNotes(): ReadonlyMap<string, readonly string[]>;
  status(key: string, state: ApplicationState, discriminator: string): void;
  note(key: string, text: string): void;
  score(key: string, score: number, reasons: readonly string[], discriminator: string): void;
  unknownState(description: string): void;
  warn(message: string): void;
};

type Counters = {
  created: number;
  skipped: number;
  unknownStates: string[];
  warnings: string[];
};

type Operation = () => Promise<void>;

async function drain(operations: readonly Operation[]): Promise<void> {
  const [head, ...rest] = operations;
  if (head === undefined) return;
  await head();
  await drain(rest);
}

export async function withImporter(
  dir: DataDir,
  source: string,
  mapFile: string,
  collect: (importer: Importer) => void,
): Promise<ImportResult> {
  try {
    return await withLock(path.join(dir.path, LOCK_DIRECTORY), async () => {
      const map = new IdempotencyMap(path.join(dir.path, mapFile));
      const existing = await readEvents(dir);
      const leadKeys = new Set(
        existing.filter((event) => event.kind === "lead.created").map((event) => event.key ?? ""),
      );
      const notesByKey = new Map<string, string[]>();
      for (const event of existing) {
        if (event.kind !== "note" || event.key === undefined) continue;
        notesByKey.set(event.key, [...(notesByKey.get(event.key) ?? []), event.text]);
      }
      const counters: Counters = { created: 0, skipped: 0, unknownStates: [], warnings: [] };
      const operations: Operation[] = [];

      async function once(fingerprint: string, event: NewEvent): Promise<void> {
        if (map.lookup(fingerprint) !== null) {
          counters.skipped += 1;
          return;
        }
        const stored = await appendEvent(dir, event);
        map.record(fingerprint, stored.id);
        counters.created += 1;
      }

      async function createLead(key: string, posting: Posting): Promise<void> {
        const fingerprint = `${source}:lead:${key}`;
        if (map.lookup(fingerprint) !== null) {
          counters.skipped += 1;
          return;
        }
        if (leadKeys.has(key)) {
          map.record(fingerprint, "existing");
          counters.skipped += 1;
          return;
        }
        await ledgerRecord(dir, posting, "seen");
        await once(fingerprint, { kind: "lead.created", key, posting, eligibility: "unknown" });
        leadKeys.add(key);
      }

      const importer: Importer = {
        lead(posting, preferredKey) {
          const key = preferredKey ?? dedupKey(posting);
          operations.push(() => createLead(key, posting));
          return key;
        },
        hadLead(key) {
          return leadKeys.has(key);
        },
        existingNotes() {
          return notesByKey;
        },
        status(key, state, discriminator) {
          operations.push(() =>
            once(`${source}:status:${key}:${state}:${discriminator}`, { kind: "status.changed", key, to: state }),
          );
        },
        note(key, text) {
          operations.push(() => once(`${source}:note:${key}:${text}`, { kind: "note", key, text }));
        },
        score(key, score, reasons, discriminator) {
          operations.push(() =>
            once(`${source}:score:${key}:${score}:${discriminator}`, {
              kind: "score.recorded",
              key,
              score,
              reasons,
              liveness: "unknown",
            }),
          );
        },
        unknownState(description) {
          if (!counters.unknownStates.includes(description)) counters.unknownStates.push(description);
        },
        warn(message) {
          counters.warnings.push(message);
        },
      };

      collect(importer);
      await drain(operations);
      return { ok: true as const, value: { source, ...counters } };
    });
  } catch (error) {
    return { ok: false, error: { code: "migrate-failed", message: errorMessage(error) } };
  }
}

const LEGACY_ID_NOTE = /^legacy id (\S+)$/;
const LINEAR_NOTE = /^linear ([^\s;]+);/;

export type KeyedId = { readonly id: string; readonly key: string };

export function legacyIdNote(legacyId: string): string {
  return `legacy id ${legacyId}`;
}

function addTo(index: Map<string, Set<string>>, from: string, value: string): void {
  const values = index.get(from) ?? new Set<string>();
  values.add(value);
  index.set(from, values);
}

function indexNotes(
  importer: Importer,
  extra: readonly KeyedId[],
  pattern: RegExp,
): Map<string, Set<string>> {
  const byKey = new Map<string, Set<string>>();
  for (const [key, texts] of importer.existingNotes()) {
    for (const text of texts) {
      const id = pattern.exec(text)?.[1];
      if (id !== undefined) addTo(byKey, key, id);
    }
  }
  for (const entry of extra) addTo(byKey, entry.key, entry.id);
  return byKey;
}

function invert(byKey: ReadonlyMap<string, ReadonlySet<string>>): Map<string, Set<string>> {
  const byId = new Map<string, Set<string>>();
  for (const [key, ids] of byKey) for (const id of ids) addTo(byId, id, key);
  return byId;
}

export function linkLegacyIds(
  importer: Importer,
  found: { readonly legacy: readonly KeyedId[]; readonly linear: readonly KeyedId[]; readonly reportUnmatched: boolean },
): void {
  const legacyByKey = indexNotes(importer, found.legacy, LEGACY_ID_NOTE);
  const linearByKey = indexNotes(importer, found.linear, LINEAR_NOTE);
  const keysByLegacy = invert(legacyByKey);
  for (const [key, linearIds] of linearByKey) {
    const legacyIds = legacyByKey.get(key);
    if (legacyIds === undefined) continue;
    const [legacyId] = [...legacyIds];
    if (legacyId === undefined) continue;
    if (legacyIds.size > 1) {
      importer.warn(`legacy ids ${[...legacyIds].join(", ")} map to the same Linear issue on ${key}; not linked`);
    } else if (linearIds.size > 1) {
      importer.warn(`legacy id ${legacyId} matches several Linear issues (${[...linearIds].join(", ")}); not linked`);
    } else if ((keysByLegacy.get(legacyId)?.size ?? 0) > 1) {
      importer.warn(`legacy id ${legacyId} is recorded on several Leads; not linked`);
    } else {
      const [linearId] = [...linearIds];
      const text = `legacy ${legacyId} = linear ${linearId ?? ""}`;
      if (!(importer.existingNotes().get(key) ?? []).includes(text)) importer.note(key, text);
    }
  }
  if (!found.reportUnmatched) return;
  const unmatched = [...keysByLegacy]
    .filter(([, keys]) => [...keys].every((key) => !linearByKey.has(key)))
    .map(([legacyId]) => legacyId)
    .toSorted();
  if (unmatched.length > 0) importer.warn(`legacy ids with no Linear match: ${unmatched.join(", ")}`);
}
