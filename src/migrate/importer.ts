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
