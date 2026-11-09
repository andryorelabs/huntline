import type { CommandContext } from "../core/commands.ts";
import { loadProfile } from "../core/data-dir.ts";
import { errorMessage } from "../core/narrow.ts";
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
import { sources as defaultSources } from "../sources/index.ts";
import { readEvents } from "../ledger/events.ts";
import { createTracker, projectEvents } from "../tracker/index.ts";
import { addCounts, EMPTY_COUNTS, processBatch } from "./pipeline.ts";
import type {
  IngestReport,
  SourceCounts,
  SourceReport,
  SweepOptions,
  SweepReport,
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
};

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function prepare(ctx: CommandContext): Result<Prepared> {
  if (ctx.dataDir === null) {
    return fail("data-dir-not-found", "no data dir resolved; pass --data or set HUNTLINE_HOME");
  }
  const profile = loadProfile(ctx.dataDir);
  if (!profile.ok) return profile;
  return { ok: true, value: { dir: ctx.dataDir, profile: profile.value } };
}

function trackerFor(ctx: CommandContext, prepared: Prepared, injected: TrackerAdapter | undefined): TrackerAdapter {
  if (injected !== undefined) return injected;
  return createTracker(prepared.profile.tracker, prepared.dir, { apiKey: ctx.env["LINEAR_API_KEY"] });
}

async function projectLeads(tracker: TrackerAdapter, dir: DataDir): Promise<Result<TrackerSummary>> {
  const events = await readEvents(dir);
  if (!events.some((event) => event.kind === "lead.created")) return { ok: true, value: { created: 0, updated: 0 } };
  const projected = await projectEvents(tracker, dir, events);
  if (!projected.ok) {
    return fail(projected.error.code, `leads recorded but not projected: ${projected.error.message}`);
  }
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
): Promise<Fetched> {
  if (adapter === undefined) {
    return { source, postings: [], errors: [`${source}: unknown source`], warnings: [] };
  }
  const results = await Promise.all(queries.map((query) => safeFetch(adapter, query)));
  return {
    source,
    postings: results.flatMap((result) => result.postings),
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
  };
}

function statusOf(errors: readonly string[], counts: SourceCounts): SourceReport["status"] {
  if (errors.length > 0) return "failed";
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
    status: statusOf(current.errors, batch.counts),
    errors: current.errors,
    warnings: current.warnings,
  };
  return ingestFetched(prepared, fetched, index + 1, {
    reports: [...collected.reports, report],
    events: [...collected.events, ...batch.events],
    leads: [...collected.leads, ...batch.leadKeys],
  });
}

function summarize(collected: Collected, tracker: TrackerSummary): SweepReport {
  const failed = collected.reports
    .filter((report) => report.status === "failed")
    .map((report) => ({ source: report.source, errors: report.errors }));
  const empty = collected.reports.filter((report) => report.status === "empty").map((report) => report.source);
  const totals = collected.reports.reduce<SourceCounts>((sum, report) => addCounts(sum, report), EMPTY_COUNTS);
  return { sources: collected.reports, failed, empty, totals, leads: collected.leads, tracker };
}

function selectSources(profile: Profile, options: SweepOptions): string[] {
  const configured = [...new Set(profile.sources)];
  if (options.only === undefined || options.only.length === 0) return configured;
  return options.only.filter((name) => configured.includes(name));
}

export async function runSweep(ctx: CommandContext, options: SweepOptions = {}): Promise<Result<SweepReport>> {
  const prepared = prepare(ctx);
  if (!prepared.ok) return prepared;
  const companies = readCompanies(prepared.value.dir);
  if (!companies.ok) return companies;
  const adapters = options.adapters ?? defaultSources;
  const names = selectSources(prepared.value.profile, options);
  const fetched = await Promise.all(
    names.map((name) =>
      fetchSource(name, adapters[name], queriesFor(name, companies.value, options.keywords)),
    ),
  );
  try {
    const collected = await ingestFetched(prepared.value, fetched, 0, { reports: [], events: [], leads: [] });
    const tracker = await projectLeads(trackerFor(ctx, prepared.value, options.tracker), prepared.value.dir);
    if (!tracker.ok) return tracker;
    return { ok: true, value: summarize(collected, tracker.value) };
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
  const labelled = postings.map((posting) => (posting.source.trim() === "" ? { ...posting, source } : posting));
  try {
    const batch = await processBatch(prepared.value.dir, prepared.value.profile, labelled);
    const tracker = await projectLeads(trackerFor(ctx, prepared.value, options.tracker), prepared.value.dir);
    if (!tracker.ok) return tracker;
    return { ok: true, value: { source, ...batch.counts, leads: batch.leadKeys, tracker: tracker.value } };
  } catch (error) {
    return fail("ingest-failed", errorMessage(error));
  }
}
