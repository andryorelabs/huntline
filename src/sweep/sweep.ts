import { readFileSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { loadProfile } from "../core/data-dir.ts";
import { writeAtomic } from "../core/fs.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import type {
  DataDir,
  HuntEvent,
  Posting,
  Profile,
  Result,
  SourceAdapter,
  SourceQuery,
  SourceResult,
  TrackerAdapter,
} from "../core/types.ts";
import { readCompanies } from "../sources/companies.ts";
import { resolveBoards, type ResolvedBoard } from "../sources/index.ts";
import { readEvents } from "../ledger/events.ts";
import { createTracker, projectEvents } from "../tracker/index.ts";
import { addCounts, EMPTY_COUNTS, processBatch } from "./pipeline.ts";
import type {
  IngestReport,
  SourceCounts,
  SourceReport,
  SweepOptions,
  SweepReport,
  SkippedBoard,
  TrackerSummary,
} from "./types.ts";

const ATS_SOURCES: ReadonlySet<string> = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "smartrecruiters",
]);

type Prepared = { readonly dir: DataDir; readonly profile: Profile };

type Fetched = {
  readonly source: string;
  readonly postings: Posting[];
  readonly errors: string[];
  readonly warnings: string[];
  readonly misconfigured: boolean;
};

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function prepare(ctx: CommandContext): Result<Prepared> {
  if (ctx.dataDir === null) {
    return fail("data-dir-not-found", "no data dir resolved; pass --data or set JOBSHIP_HOME");
  }
  const profile = loadProfile(ctx.dataDir);
  if (!profile.ok) return profile;
  return { ok: true, value: { dir: ctx.dataDir, profile: profile.value } };
}

function trackerFor(
  ctx: CommandContext,
  prepared: Prepared,
  injected: TrackerAdapter | undefined,
): TrackerAdapter {
  if (injected !== undefined) return injected;
  return createTracker(prepared.profile.tracker, prepared.dir, {
    apiKey: ctx.env["LINEAR_API_KEY"],
  });
}

const PENDING_FILE = "pending-projection.json";

function readPending(dir: DataDir): string[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(dir.path, PENDING_FILE), "utf8"));
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function writePending(dir: DataDir, keys: readonly string[]): void {
  writeAtomic(path.join(dir.path, PENDING_FILE), `${JSON.stringify(keys)}\n`);
}

async function projectLeads(
  tracker: TrackerAdapter,
  dir: DataDir,
  newKeys: readonly string[],
): Promise<Result<TrackerSummary>> {
  const keys = [...new Set([...readPending(dir), ...newKeys])];
  if (keys.length === 0) return { ok: true, value: { created: 0, updated: 0 } };
  const wanted = new Set(keys);
  const events = (await readEvents(dir)).filter(
    (event) => event.key !== undefined && wanted.has(event.key),
  );
  const projected = await projectEvents(tracker, dir, events);
  if (!projected.ok) {
    writePending(dir, keys);
    return fail(
      projected.error.code,
      `leads recorded but not projected: ${projected.error.message}`,
    );
  }
  writePending(dir, []);
  return { ok: true, value: projected.value };
}

function queryFor(slug: string | undefined, keywords: readonly string[] | undefined): SourceQuery {
  return {
    ...(slug === undefined ? {} : { slug, company: slug }),
    ...(keywords === undefined ? {} : { keywords }),
  };
}

function queriesFor(
  source: string,
  companies: readonly { readonly ats: string; readonly slug: string }[],
  keywords: readonly string[] | undefined,
): SourceQuery[] {
  if (!ATS_SOURCES.has(source)) return [queryFor(undefined, keywords)];
  return companies
    .filter((company) => company.ats === source)
    .map((company) => queryFor(company.slug, keywords));
}

async function safeFetch(adapter: SourceAdapter, query: SourceQuery): Promise<SourceResult> {
  try {
    return await adapter.fetch(query);
  } catch (error) {
    return { postings: [], errors: [`${adapter.name}: ${errorMessage(error)}`], warnings: [] };
  }
}

async function fetchSource(
  source: string,
  adapter: SourceAdapter | undefined,
  queries: readonly SourceQuery[],
  problem: string | undefined,
): Promise<Fetched> {
  if (adapter === undefined) {
    return {
      source,
      postings: [],
      errors: [problem ?? `${source}: unknown source`],
      warnings: [],
      misconfigured: false,
    };
  }
  if (ATS_SOURCES.has(source) && queries.length === 0) {
    return {
      source,
      postings: [],
      errors: [],
      warnings: [`${source}: no companies saved; run jobship company add <url>`],
      misconfigured: true,
    };
  }
  const results = await Promise.all(queries.map((query) => safeFetch(adapter, query)));
  return {
    source,
    postings: results.flatMap((result) => result.postings),
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
    misconfigured: false,
  };
}

function statusOf(
  errors: readonly string[],
  counts: SourceCounts,
  misconfigured: boolean,
): SourceReport["status"] {
  if (errors.length > 0) return "failed";
  if (misconfigured) return "misconfigured";
  return counts.seen === 0 ? "empty" : "ok";
}

type Collected = {
  readonly reports: SourceReport[];
  readonly events: HuntEvent[];
  readonly leads: string[];
};

async function ingestFetched(
  prepared: Prepared,
  fetched: readonly Fetched[],
  index: number,
  collected: Collected,
): Promise<Collected> {
  const current = fetched[index];
  if (current === undefined) return collected;
  const batch = await processBatch(prepared.dir, prepared.profile, current.postings);
  const report: SourceReport = {
    source: current.source,
    ...batch.counts,
    status: statusOf(current.errors, batch.counts, current.misconfigured),
    errors: current.errors,
    warnings: current.warnings,
  };
  return ingestFetched(prepared, fetched, index + 1, {
    reports: [...collected.reports, report],
    events: [...collected.events, ...batch.events],
    leads: [...collected.leads, ...batch.leadKeys],
  });
}

function summarize(
  collected: Collected,
  tracker: TrackerSummary,
  skipped: readonly SkippedBoard[],
): SweepReport {
  const failed = collected.reports
    .filter((report) => report.status === "failed")
    .map((report) => ({ source: report.source, errors: report.errors }));
  const empty = collected.reports
    .filter((report) => report.status === "empty")
    .map((report) => report.source);
  const misconfigured = collected.reports
    .filter((report) => report.status === "misconfigured")
    .map((report) => report.source);
  const totals = collected.reports.reduce<SourceCounts>(
    (sum, report) => addCounts(sum, report),
    EMPTY_COUNTS,
  );
  return {
    sources: collected.reports,
    failed,
    empty,
    misconfigured,
    skipped,
    totals,
    leads: collected.leads,
    tracker,
  };
}

const BOARD_RUNS_FILE = "board-runs.json";

type BoardRuns = Readonly<Record<string, number>>;

function readBoardRuns(dir: DataDir): BoardRuns {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(dir.path, BOARD_RUNS_FILE), "utf8"));
    if (!isObject(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  } catch {
    return {};
  }
}

function writeBoardRuns(dir: DataDir, runs: BoardRuns): void {
  writeAtomic(path.join(dir.path, BOARD_RUNS_FILE), `${JSON.stringify(runs, null, 2)}\n`);
}

function skipReason(board: ResolvedBoard, runs: BoardRuns, now: number): string | undefined {
  const interval = board.minIntervalMinutes;
  const last = runs[board.id];
  if (interval === undefined || last === undefined) return undefined;
  const retryAt = last + interval * 60_000;
  if (retryAt <= now) return undefined;
  return `fetched at ${new Date(last).toISOString()}; minimum interval ${interval} minutes, next run after ${new Date(retryAt).toISOString()}`;
}

function selectBoards(
  resolved: readonly ResolvedBoard[],
  options: SweepOptions,
): Result<ResolvedBoard[]> {
  const fetchable = resolved.filter(
    (entry) => entry.board === undefined || entry.board.access === "feed",
  );
  if (options.only === undefined || options.only.length === 0)
    return { ok: true, value: fetchable };
  const names = fetchable.map((entry) => entry.id);
  const unknown = options.only.filter((name) => !names.includes(name));
  if (unknown.length > 0) {
    return fail(
      "usage",
      `--source ${unknown.join(", ")} not in the Profile sources (${names.join(", ") || "none"})`,
    );
  }
  return { ok: true, value: fetchable.filter((entry) => options.only?.includes(entry.id)) };
}

function partitionByInterval(
  boards: readonly ResolvedBoard[],
  runs: BoardRuns,
  now: number,
): { readonly due: ResolvedBoard[]; readonly skipped: SkippedBoard[] } {
  const due: ResolvedBoard[] = [];
  const skipped: SkippedBoard[] = [];
  for (const board of boards) {
    const reason = skipReason(board, runs, now);
    if (reason === undefined) due.push(board);
    else skipped.push({ source: board.id, reason });
  }
  return { due, skipped };
}

function recordRuns(
  dir: DataDir,
  runs: BoardRuns,
  due: readonly ResolvedBoard[],
  now: number,
): void {
  const timed = due.filter((board) => board.minIntervalMinutes !== undefined);
  if (timed.length === 0) return;
  writeBoardRuns(dir, {
    ...runs,
    ...Object.fromEntries(timed.map((board) => [board.id, now])),
  });
}

export async function runSweep(
  ctx: CommandContext,
  options: SweepOptions = {},
): Promise<Result<SweepReport>> {
  const prepared = prepare(ctx);
  if (!prepared.ok) return prepared;
  const companies = readCompanies(prepared.value.dir);
  if (!companies.ok) return companies;
  const resolved = await resolveBoards(prepared.value.profile, prepared.value.dir, {
    env: ctx.env,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  if (!resolved.ok) return resolved;
  const selected = selectBoards(resolved.value, options);
  if (!selected.ok) return selected;
  const now = (options.now ?? Date.now)();
  const runs = readBoardRuns(prepared.value.dir);
  const { due, skipped } = partitionByInterval(selected.value, runs, now);
  const fetched = await Promise.all(
    due.map((board) =>
      fetchSource(
        board.id,
        options.adapters?.[board.id] ?? board.adapter,
        queriesFor(board.id, companies.value, options.keywords),
        board.problem,
      ),
    ),
  );
  recordRuns(prepared.value.dir, runs, due, now);
  try {
    const collected = await ingestFetched(prepared.value, fetched, 0, {
      reports: [],
      events: [],
      leads: [],
    });
    const tracker = await projectLeads(
      trackerFor(ctx, prepared.value, options.tracker),
      prepared.value.dir,
      collected.leads,
    );
    if (!tracker.ok) return tracker;
    return { ok: true, value: summarize(collected, tracker.value, skipped) };
  } catch (error) {
    return fail("sweep-failed", errorMessage(error));
  }
}

export async function ingestPostings(
  ctx: CommandContext,
  postings: Posting[],
  source: string,
  options: Pick<SweepOptions, "tracker"> = {},
): Promise<Result<IngestReport>> {
  const prepared = prepare(ctx);
  if (!prepared.ok) return prepared;
  const labelled = postings.map((posting) =>
    posting.source.trim() === "" ? { ...posting, source } : posting,
  );
  try {
    const batch = await processBatch(prepared.value.dir, prepared.value.profile, labelled);
    const tracker = await projectLeads(
      trackerFor(ctx, prepared.value, options.tracker),
      prepared.value.dir,
      batch.leadKeys,
    );
    if (!tracker.ok) return tracker;
    return {
      ok: true,
      value: { source, ...batch.counts, leads: batch.leadKeys, tracker: tracker.value },
    };
  } catch (error) {
    return fail("ingest-failed", errorMessage(error));
  }
}
