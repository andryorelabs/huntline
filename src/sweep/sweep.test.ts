import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { isObject } from "../core/narrow.ts";
import type { HuntEvent, Posting, SourceAdapter } from "../core/types.ts";
import { dedupKey, readLedger } from "../ledger/dedup.ts";
import { readEvents } from "../ledger/events.ts";
import { createTracker } from "../tracker/index.ts";
import type { FetchLike } from "../tracker/linear.ts";
import linearFixture from "../tracker/linear-fixture.json";
import { run } from "./command.ts";
import { recordScore } from "./score.ts";
import { ingestPostings, runSweep } from "./sweep.ts";

let root = "";

function makeContext(): CommandContext {
  return { dataDir: { path: root }, env: {}, cwd: root };
}

function writeProfile(
  sources: string[],
  tracker: Record<string, unknown> = { kind: "local" },
): void {
  writeFileSync(path.join(root, "huntline.json"), '{"version":1}\n');
  writeFileSync(
    path.join(root, "profile.yaml"),
    JSON.stringify({
      regions: ["LATAM"],
      contractTypes: ["full-time"],
      remote: "any",
      stack: { include: [], exclude: [] },
      salaryFloor: null,
      excludedCompanies: [],
      outreachDailyCap: 5,
      sources,
      tracker,
    }),
  );
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "huntline-sweep-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function posting(overrides: Partial<Posting> = {}): Posting {
  return {
    id: "1001",
    source: "himalayas",
    url: "https://example.test/jobs/1001",
    company: "Acme Inc.",
    title: "Backend Engineer",
    location: "Worldwide",
    ...overrides,
  };
}

function staticAdapter(name: string, postings: Posting[]): SourceAdapter {
  return { name, fetch: () => Promise.resolve({ postings, errors: [], warnings: [] }) };
}

function rateLimitedAdapter(name: string): SourceAdapter {
  return {
    name,
    fetch: () =>
      Promise.resolve({
        postings: [],
        errors: [`${name}: HTTP 429 rate limited by https://example.test/${name}`],
        warnings: [],
      }),
  };
}

function queryOf(init: RequestInit): string {
  if (typeof init.body !== "string") throw new Error("expected a string request body");
  const parsed: unknown = JSON.parse(init.body);
  const query = isObject(parsed) ? parsed["query"] : undefined;
  if (typeof query !== "string") throw new Error("request body has no query");
  return query;
}

describe("runSweep", () => {
  test("a rate limited Source is reported failed while the others still produce Leads", async () => {
    writeProfile(["himalayas", "remoteok", "hn"]);
    const adapters = {
      himalayas: staticAdapter("himalayas", [posting()]),
      remoteok: rateLimitedAdapter("remoteok"),
      hn: staticAdapter("hn", []),
    };
    const result = await runSweep(makeContext(), { adapters });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.failed).toHaveLength(1);
    expect(result.value.failed[0]?.source).toBe("remoteok");
    expect(result.value.failed[0]?.errors[0]).toContain("429");
    expect(result.value.empty).toEqual(["hn"]);
    expect(result.value.leads).toEqual([dedupKey(posting())]);
    const himalayas = result.value.sources.find((entry) => entry.source === "himalayas");
    expect(himalayas).toMatchObject({ seen: 1, known: 0, new: 1, status: "ok" });
    expect((await readEvents({ path: root })).map((event) => event.kind)).toEqual(["lead.created"]);
  });

  test("a second sweep sees everything as known and records no new Events", async () => {
    writeProfile(["himalayas"]);
    const adapters = {
      himalayas: staticAdapter("himalayas", [
        posting(),
        posting({ id: "2", title: "Data Engineer" }),
      ]),
    };
    await runSweep(makeContext(), { adapters });
    const second = await runSweep(makeContext(), { adapters });
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.totals).toEqual({ seen: 2, known: 2, new: 0, dismissed: 0 });
    expect(await readEvents({ path: root })).toHaveLength(2);
  });

  test("a second sweep with the linear adapter creates no duplicate issues", async () => {
    writeProfile(["himalayas"], { kind: "linear", team: "HNT" });
    const operations: string[] = [];
    const responses: Record<string, unknown> = linearFixture;
    const fetchImpl: FetchLike = (_input, init) => {
      const operation = /(?:query|mutation) (\w+)/.exec(queryOf(init))?.[1] ?? "";
      operations.push(operation);
      return Promise.resolve(
        Response.json(responses[operation] ?? { errors: [{ message: "unrecorded" }] }),
      );
    };
    const tracker = createTracker(
      { kind: "linear", team: "HNT" },
      { path: root },
      { apiKey: "lin_api_synthetic", fetch: fetchImpl },
    );
    const adapters = { himalayas: staticAdapter("himalayas", [posting()]) };
    const first = await runSweep(makeContext(), { adapters, tracker });
    const second = await runSweep(makeContext(), { adapters, tracker });
    if (!first.ok || !second.ok) throw new Error("sweep failed");
    expect(first.value.tracker).toMatchObject({ created: 1 });
    expect(second.value.tracker).toEqual({ created: 0, updated: 0 });
    expect(operations.filter((operation) => operation === "CreateIssue")).toHaveLength(1);
  });

  test("a failed tracker projection fails the run and the next sweep projects the orphaned Lead", async () => {
    writeProfile(["himalayas"], { kind: "linear", team: "HNT" });
    const operations: string[] = [];
    const responses: Record<string, unknown> = linearFixture;
    let healthy = false;
    const fetchImpl: FetchLike = (_input, init) => {
      const operation = /(?:query|mutation) (\w+)/.exec(queryOf(init))?.[1] ?? "";
      if (healthy) operations.push(operation);
      const payload = healthy ? responses[operation] : { errors: [{ message: "down" }] };
      return Promise.resolve(Response.json(payload ?? { errors: [{ message: "unrecorded" }] }));
    };
    const tracker = createTracker(
      { kind: "linear", team: "HNT" },
      { path: root },
      { apiKey: "lin_api_synthetic", fetch: fetchImpl },
    );
    const adapters = { himalayas: staticAdapter("himalayas", [posting()]) };
    const first = await runSweep(makeContext(), { adapters, tracker });
    expect(first.ok).toBe(false);
    healthy = true;
    const second = await runSweep(makeContext(), { adapters, tracker });
    if (!second.ok) throw new Error("second sweep failed");
    expect(operations.filter((operation) => operation === "CreateIssue")).toHaveLength(1);
  });

  test("a Posting that states a US-only region is dismissed with a reason", async () => {
    writeProfile(["himalayas"]);
    const adapters = { himalayas: staticAdapter("himalayas", [posting({ location: "US only" })]) };
    const result = await runSweep(makeContext(), { adapters });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.totals).toMatchObject({ new: 0, dismissed: 1 });
    const events = await readEvents({ path: root });
    expect(events[0]).toMatchObject({ kind: "posting.dismissed", reason: "region" });
  });

  test("a silent Posting becomes a Lead with unknown eligibility", async () => {
    writeProfile(["himalayas"]);
    const adapters = { himalayas: staticAdapter("himalayas", [posting({ location: "" })]) };
    await runSweep(makeContext(), { adapters });
    const events = await readEvents({ path: root });
    expect(events[0]).toMatchObject({ kind: "lead.created", eligibility: "unknown" });
  });

  test("the same role from two Sources yields one Lead and a duplicate ledger entry", async () => {
    writeProfile(["greenhouse", "himalayas"]);
    const adapters = {
      greenhouse: staticAdapter("greenhouse", [posting({ source: "greenhouse", id: "g1" })]),
      himalayas: staticAdapter("himalayas", [posting({ source: "himalayas", id: "h1" })]),
    };
    writeFileSync(
      path.join(root, "companies.json"),
      JSON.stringify({ companies: [{ ats: "greenhouse", slug: "acme" }] }),
    );
    const result = await runSweep(makeContext(), { adapters });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.totals).toMatchObject({ new: 1, known: 1 });
    const ledger = await readLedger({ path: root });
    expect(ledger.map((entry) => entry.outcome)).toEqual(["seen", "duplicate"]);
  });

  test("an unknown Source and a throwing adapter are reported failed", async () => {
    writeProfile(["nope", "himalayas"]);
    const adapters = {
      himalayas: {
        name: "himalayas",
        fetch: () => Promise.reject(new Error("boom")),
      } satisfies SourceAdapter,
    };
    const result = await runSweep(makeContext(), { adapters });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.failed.map((entry) => entry.source)).toEqual(["nope", "himalayas"]);
  });

  test("concurrent ingests of the same role create one Lead", async () => {
    writeProfile([]);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => ingestPostings(makeContext(), [posting()], "himalayas")),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    const leads = (await readEvents({ path: root })).filter(
      (event) => event.kind === "lead.created",
    );
    expect(leads).toHaveLength(1);
  });

  test("fails without a data dir", async () => {
    const result = await runSweep({ dataDir: null, env: {}, cwd: root });
    expect(result).toMatchObject({ ok: false, error: { code: "data-dir-not-found" } });
  });
});

describe("ingestPostings", () => {
  test("a Posting already seen creates no new Lead", async () => {
    writeProfile([]);
    const wellfound = posting({
      source: "wellfound",
      id: "wf-1",
      url: "https://example.test/wf/1",
    });
    const first = await ingestPostings(makeContext(), [wellfound], "wellfound");
    const second = await ingestPostings(makeContext(), [wellfound], "wellfound");
    if (!first.ok || !second.ok) throw new Error("ingest failed");
    expect(first.value).toMatchObject({ seen: 1, new: 1 });
    expect(second.value).toMatchObject({ seen: 1, known: 1, new: 0, leads: [] });
    expect(
      (await readEvents({ path: root })).filter((event) => event.kind === "lead.created"),
    ).toHaveLength(1);
  });

  test("fills a blank source from the label", async () => {
    writeProfile([]);
    const result = await ingestPostings(makeContext(), [posting({ source: "" })], "jobspy");
    if (!result.ok) throw new Error(result.error.message);
    const events = await readEvents({ path: root });
    expect(events[0]).toMatchObject({ posting: { source: "jobspy" } });
  });
});

async function seedLead(): Promise<string> {
  writeProfile([]);
  const ingested = await ingestPostings(makeContext(), [posting()], "himalayas");
  if (!ingested.ok || ingested.value.leads[0] === undefined) throw new Error("no lead");
  return ingested.value.leads[0];
}

function lastScore(events: HuntEvent[]): HuntEvent | undefined {
  return events.findLast((event) => event.kind === "score.recorded");
}

describe("ingest payload validation", () => {
  test("null optional fields are dropped and mistyped ones are rejected", async () => {
    writeProfile([]);
    const accepted = await run(
      [
        "ingest",
        "--source",
        "wellfound",
        "--json",
        JSON.stringify([{ ...posting(), remote: null, location: null, contract: null }]),
      ],
      makeContext(),
    );
    expect(accepted).toMatchObject({ ok: true, data: { new: 1 } });
    const events = await readEvents({ path: root });
    expect(events.find((event) => event.kind === "lead.created")).toMatchObject({
      eligibility: "unknown",
    });
    const rejected = await run(
      [
        "ingest",
        "--source",
        "wellfound",
        "--json",
        JSON.stringify([{ ...posting({ id: "2" }), remote: "no" }]),
      ],
      makeContext(),
    );
    expect(rejected).toMatchObject({ ok: false });
  });
});

describe("recordScore", () => {
  test("records score, reasons and liveness as an Event", async () => {
    const key = await seedLead();
    const result = await recordScore(makeContext(), key, {
      score: 82,
      reasons: ["stack match"],
      liveness: "live",
    });
    expect(result.ok).toBe(true);
    expect(lastScore(await readEvents({ path: root }))).toMatchObject({
      score: 82,
      reasons: ["stack match"],
      liveness: "live",
    });
  });

  test("a liveness check that errored records unknown, never closed", async () => {
    const key = await seedLead();
    await recordScore(makeContext(), key, {
      score: 50,
      reasons: [],
      livenessError: "HTTP 503",
      liveness: "closed",
    });
    expect(lastScore(await readEvents({ path: root }))).toMatchObject({ liveness: "unknown" });
  });

  test("an unrecognised or missing liveness records unknown", async () => {
    const key = await seedLead();
    await recordScore(makeContext(), key, { score: 50, reasons: [], liveness: "error" });
    expect(lastScore(await readEvents({ path: root }))).toMatchObject({ liveness: "unknown" });
  });

  test("rejects out of range scores and unknown keys", async () => {
    const key = await seedLead();
    expect(await recordScore(makeContext(), key, { score: 101, reasons: [] })).toMatchObject({
      ok: false,
    });
    expect(await recordScore(makeContext(), "missing", { score: 10, reasons: [] })).toMatchObject({
      ok: false,
      error: { code: "not-found" },
    });
  });
});

describe("command", () => {
  test("ingest reads a postings file and score reports liveness", async () => {
    writeProfile([]);
    const file = path.join(root, "postings.json");
    writeFileSync(file, JSON.stringify([posting()]));
    const ingested = await run(["ingest", "--source", "wellfound", "--file", file], makeContext());
    expect(ingested).toMatchObject({ ok: true, data: { new: 1 } });
    const key = dedupKey(posting());
    const scored = await run(
      ["score", key, "--score", "70", "--reason", "good fit", "--liveness-error", "timeout"],
      makeContext(),
    );
    expect(scored).toMatchObject({ ok: true, data: { liveness: "unknown", score: 70 } });
    expect(readFileSync(file, "utf8")).toContain("Backend");
  });

  test("usage errors", async () => {
    writeProfile([]);
    expect(await run(["ingest"], makeContext())).toMatchObject({
      ok: false,
      error: { code: "usage" },
    });
    expect(await run(["ingest", "--source", "x", "--json", "{}"], makeContext())).toMatchObject({
      ok: false,
      error: { code: "usage" },
    });
    expect(await run(["score"], makeContext())).toMatchObject({
      ok: false,
      error: { code: "usage" },
    });
    expect(await run(["sweep", "extra"], makeContext())).toMatchObject({
      ok: false,
      error: { code: "usage" },
    });
  });

  test("sweep with no configured sources reports an empty run", async () => {
    writeProfile([]);
    expect(await run(["sweep"], makeContext())).toMatchObject({
      ok: true,
      data: { failed: [], empty: [] },
    });
  });
});

describe("sweep configuration", () => {
  test("an ATS Source with no saved companies is misconfigured, not empty", async () => {
    writeProfile(["greenhouse"]);
    const result = await runSweep(makeContext(), {
      adapters: { greenhouse: staticAdapter("greenhouse", []) },
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.sources[0]).toMatchObject({
      source: "greenhouse",
      status: "misconfigured",
    });
    expect(result.value.sources[0]?.warnings.join(" ")).toContain("huntline company add");
    expect(result.value.empty).toEqual([]);
    expect(result.value.misconfigured).toEqual(["greenhouse"]);
  });

  test("--source naming a Source outside the Profile is a usage failure", async () => {
    writeProfile(["hn"]);
    const result = await run(["sweep", "--source", "lever"], makeContext());
    expect(result).toMatchObject({ ok: false, error: { code: "usage" } });
    expect(JSON.stringify(result)).toContain("lever");
  });
});

describe("skills", () => {
  const skillsRoot = path.join(import.meta.dir, "..", "..", "skills");
  for (const name of ["sweep", "score", "browser-source"]) {
    test(`${name} has frontmatter, the untrusted fence and the no-submit rule`, () => {
      const body = readFileSync(path.join(skillsRoot, name, "SKILL.md"), "utf8");
      expect(body.startsWith(`---\nname: ${name}\ndescription: `)).toBe(true);
      expect(body.indexOf("\n---\n", 4)).toBeGreaterThan(0);
      expect(body).toContain("Untrusted content");
      expect(body).toContain("untrusted-posting");
      expect(body).toContain("No submit");
    });
  }

  test("browser-source documents Wellfound GraphQL, LinkedIn and X", () => {
    const body = readFileSync(path.join(skillsRoot, "browser-source", "SKILL.md"), "utf8");
    for (const heading of ["## Wellfound (GraphQL)", "## LinkedIn", "## X"])
      expect(body).toContain(heading);
  });
});
