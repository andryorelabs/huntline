import path from "node:path";
import { withLock } from "../core/fs.ts";
import { evaluateGates } from "../gates/gates.ts";
import { dedupKey, findDuplicate, ledgerRecord } from "../ledger/dedup.ts";
import { appendEvent } from "../ledger/events.ts";
import type { DataDir, Eligibility, HuntEvent, Posting, Profile } from "../core/types.ts";
import type { SourceCounts } from "./types.ts";

export type BatchOutcome = {
  readonly counts: SourceCounts;
  readonly leadKeys: readonly string[];
  readonly events: readonly HuntEvent[];
};

type PostingOutcome =
  | { readonly kind: "known" }
  | { readonly kind: "dismissed"; readonly event: HuntEvent }
  | { readonly kind: "lead"; readonly event: HuntEvent; readonly key: string };

const LOCK_DIRECTORY = ".pipeline";

export const EMPTY_COUNTS: SourceCounts = { seen: 0, known: 0, new: 0, dismissed: 0 };

export function addCounts(left: SourceCounts, right: SourceCounts): SourceCounts {
  return {
    seen: left.seen + right.seen,
    known: left.known + right.known,
    new: left.new + right.new,
    dismissed: left.dismissed + right.dismissed,
  };
}

function overallEligibility(values: readonly Eligibility[]): Eligibility {
  return values.every((value) => value === "eligible") ? "eligible" : "unknown";
}

async function processPosting(
  dir: DataDir,
  profile: Profile,
  posting: Posting,
): Promise<PostingOutcome> {
  const duplicate = await findDuplicate(dir, posting);
  if (duplicate !== null) {
    if (duplicate.key !== dedupKey(posting)) await ledgerRecord(dir, posting, "duplicate");
    return { kind: "known" };
  }
  const key = dedupKey(posting);
  const gates = evaluateGates(profile, posting);
  if (gates.dismissed) {
    const reason = gates.reason ?? "other";
    const event = await appendEvent(dir, { kind: "posting.dismissed", key, posting, reason });
    await ledgerRecord(dir, posting, "dismissed", reason);
    return { kind: "dismissed", event };
  }
  const eligibility = overallEligibility(Object.values(gates.eligibility));
  const event = await appendEvent(dir, { kind: "lead.created", key, posting, eligibility });
  await ledgerRecord(dir, posting, "seen");
  return { kind: "lead", event, key };
}

function absorb(accumulated: BatchOutcome, outcome: PostingOutcome): BatchOutcome {
  const seen = { ...accumulated.counts, seen: accumulated.counts.seen + 1 };
  if (outcome.kind === "known") {
    return { ...accumulated, counts: { ...seen, known: seen.known + 1 } };
  }
  if (outcome.kind === "dismissed") {
    return {
      ...accumulated,
      counts: { ...seen, dismissed: seen.dismissed + 1 },
      events: [...accumulated.events, outcome.event],
    };
  }
  return {
    counts: { ...seen, new: seen.new + 1 },
    leadKeys: [...accumulated.leadKeys, outcome.key],
    events: [...accumulated.events, outcome.event],
  };
}

async function processFrom(
  dir: DataDir,
  profile: Profile,
  postings: readonly Posting[],
  index: number,
  accumulated: BatchOutcome,
): Promise<BatchOutcome> {
  const posting = postings[index];
  if (posting === undefined) return accumulated;
  const outcome = await processPosting(dir, profile, posting);
  return processFrom(dir, profile, postings, index + 1, absorb(accumulated, outcome));
}

export function processBatch(
  dir: DataDir,
  profile: Profile,
  postings: readonly Posting[],
): Promise<BatchOutcome> {
  return withLock(path.join(dir.path, LOCK_DIRECTORY), () =>
    processFrom(dir, profile, postings, 0, { counts: EMPTY_COUNTS, leadKeys: [], events: [] }),
  );
}
