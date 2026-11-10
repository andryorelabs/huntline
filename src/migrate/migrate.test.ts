import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { foldState } from "../ledger/state.ts";
import { readEvents } from "../ledger/events.ts";
import type { FetchLike } from "../tracker/linear.ts";
import { run } from "./command.ts";
import { importLegacy } from "./legacy.ts";
import { importLinear, splitTitle } from "./linear.ts";
import { parseTables } from "./table.ts";

let root = "";
let legacyDir = "";
let ctx: CommandContext;

const SWEEP = `# Sweep

## Coverage

| Company | Source | Result |
| --- | --- | --- |
| Acme Corp | greenhouse | covered |

## Leads

| Company | Role | URL | Channel |
| --- | --- | --- | --- |
| Acme Corp | Backend Engineer | https://example.test/jobs/1 | greenhouse |
| Globex | Platform Engineer | [link](https://example.test/jobs/2) | lever |
`;

const REVIEW = `| # | Date | Company | Role | URL | Channel | Score | Verdict | Notes |
| - | ---- | ------- | ---- | --- | ------- | ----- | ------- | ----- |
| 1 | 2026-02-03 | Acme Corp | Backend Engineer | https://example.test/jobs/1 | greenhouse | 82 | apply | strong stack match |
| 2 | 2026-02-03 | Initech | Data Engineer | https://example.test/jobs/3 | lever | 40 | skip | onsite only |
| 3 | 2026-02-03 | Umbrella | SRE | https://example.test/jobs/4 | lever | 55 | wibble | |
`;

const APPLICATIONS = `| Company | Role | URL | Channel | Status | Date | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Acme Corp | Backend Engineer | https://example.test/jobs/1 | greenhouse | Interviewing | 2026-02-10 | recruiter call done |
| Hooli | Staff Engineer | https://example.test/jobs/5 | ashby | Applied | 2026-02-11 | |
| Pied Piper | Developer | https://example.test/jobs/6 | ashby | Ghosted | 2026-02-12 | |
`;

function write(relative: string, content: string): void {
  const target = path.join(legacyDir, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "huntline-migrate-"));
  legacyDir = path.join(root, "legacy");
  const dataPath = path.join(root, "data");
  mkdirSync(dataPath);
  ctx = { dataDir: { path: dataPath }, env: { LINEAR_API_KEY: "lin_synthetic_key" }, cwd: root };
  write("sweeps/2026-02-01/run.md", SWEEP);
  write("reviews/batch-2026-02-03.md", REVIEW);
  write("applications/batch-2026-02-10.md", APPLICATIONS);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("table parser", () => {
  test("normalizes headers and extracts link targets", () => {
    const [rows] = parseTables(SWEEP.split("## Leads")[1] ?? "");
    expect(rows?.[1]).toMatchObject({
      company: "Globex",
      role: "Platform Engineer",
      url: "https://example.test/jobs/2",
    });
  });
});

describe("importLegacy", () => {
  test("imports leads, scores, states, dates and outcomes", async () => {
    const result = await importLegacy(ctx, legacyDir);
    expect(result.ok).toBe(true);
    const events = await readEvents(ctx.dataDir ?? { path: "" });
    const leads = events.filter((event) => event.kind === "lead.created");
    expect(
      leads
        .map((event) => event.kind === "lead.created" && event.posting.company)
        .toSorted((left, right) => String(left).localeCompare(String(right))),
    ).toEqual(["Acme Corp", "Globex", "Hooli", "Initech", "Pied Piper", "Umbrella"]);
    const acme = events.filter((event) => event.key?.startsWith("acme|"));
    expect(foldState(acme)).toBe("interviewing");
    const acmeLead = acme.find((event) => event.kind === "lead.created");
    expect(acmeLead?.kind === "lead.created" && acmeLead.posting.url).toBe(
      "https://example.test/jobs/1",
    );
    expect(acmeLead?.kind === "lead.created" && acmeLead.posting.source).toBe("greenhouse");
    const score = events.find((event) => event.kind === "score.recorded" && event.score === 82);
    expect(score).toBeDefined();
    const initech = events.filter((event) => event.key?.startsWith("initech|"));
    expect(foldState(initech)).toBe("discarded");
    const dated = events.some(
      (event) => event.kind === "note" && event.text.includes("date 2026-02-10"),
    );
    expect(dated).toBe(true);
    const coverage = events.some(
      (event) => event.kind === "note" && event.text.includes("legacy coverage"),
    );
    expect(coverage).toBe(true);
  });

  test("reports unknown states instead of guessing", async () => {
    const result = await importLegacy(ctx, legacyDir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.unknownStates).toEqual([
      'review verdict "wibble" in batch-2026-02-03.md',
      'application state "Ghosted" in batch-2026-02-10.md',
    ]);
    const events = await readEvents(ctx.dataDir ?? { path: "" });
    const pied = events.filter((event) => event.key?.startsWith("pied piper|"));
    expect(foldState(pied)).toBe("lead");
  });

  test("running twice leaves the event count unchanged", async () => {
    const first = await importLegacy(ctx, legacyDir);
    if (!first.ok) throw new Error(first.error.message);
    const before = (await readEvents(ctx.dataDir ?? { path: "" })).length;
    expect(before).toBeGreaterThan(0);
    const second = await importLegacy(ctx, legacyDir);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.created).toBe(0);
    expect((await readEvents(ctx.dataDir ?? { path: "" })).length).toBe(before);
  });

  test("keeps coverage cards and units in the note", async () => {
    write(
      "sweeps/2026-02-02/cover.md",
      "| Company | Portal | Cards | Units |\n| --- | --- | --- | --- |\n| Zeta Corp | board | 3 | 7 |\n",
    );
    await importLegacy(ctx, legacyDir);
    const events = await readEvents(ctx.dataDir ?? { path: "" });
    const note = events.find((event) => event.kind === "note" && event.text.includes("Zeta Corp"));
    expect(
      note?.kind === "note" && note.text.includes("cards 3") && note.text.includes("units 7"),
    ).toBe(true);
  });

  test("does not follow symbolic links", async () => {
    symlinkSync(legacyDir, path.join(legacyDir, "sweeps", "2026-02-01", "loop"));
    const result = await importLegacy(ctx, legacyDir);
    expect(result.ok).toBe(true);
  });

  test("fails for a missing directory", async () => {
    const result = await importLegacy(ctx, path.join(root, "absent"));
    expect(result.ok).toBe(false);
  });
});

function issue(
  id: string,
  title: string,
  state: string,
  extra: Record<string, unknown> = {},
): unknown {
  return {
    id,
    identifier: `HNT-${id}`,
    title,
    description: "https://example.test/jobs/9\n\nsource: lever",
    url: `https://linear.example.test/${id}`,
    createdAt: "2026-03-01T10:00:00.000Z",
    state: { name: state },
    labels: { nodes: [{ name: "channel:lever" }] },
    ...extra,
  };
}

function linearFetch(pages: unknown[][]): { fetch: FetchLike; calls: () => number } {
  let call = 0;
  const fetchImpl: FetchLike = () => {
    const nodes = pages[call] ?? [];
    call += 1;
    const hasNextPage = call < pages.length;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            issues: {
              nodes,
              pageInfo: { hasNextPage, endCursor: hasNextPage ? `c${call}` : null },
            },
          },
        }),
      ),
    );
  };
  return { fetch: fetchImpl, calls: () => call };
}

const failingFetch: FetchLike = () => Promise.resolve(new Response("nope", { status: 500 }));

describe("importLinear", () => {
  const pages = [
    [
      issue("1", "Backend Engineer at Acme Corp", "Backlog"),
      issue("2", "SRE at Globex", "In Progress"),
    ],
    [
      issue("3", "Data Engineer at Initech", "Canceled"),
      issue("4", "Developer at Hooli", "Waiting On Vendor"),
      issue("5", "Untitled thing", "Todo"),
    ],
  ];

  test("maps states, reports unknown ones and paginates", async () => {
    const source = linearFetch(pages);
    const result = await importLinear(ctx, { team: "HNT", fetch: source.fetch });
    if (!result.ok) throw new Error(result.error.message);
    expect(source.calls()).toBe(2);
    expect(result.value.unknownStates).toEqual(['Linear state "Waiting On Vendor" on HNT-4']);
    expect(result.value.warnings).toHaveLength(1);
    const events = await readEvents(ctx.dataDir ?? { path: "" });
    expect(
      foldState(
        events.filter((event) => event.key?.startsWith("lever:") || event.key?.includes("sre")),
      ),
    ).not.toBeNull();
    const states = events.flatMap((event) => (event.kind === "status.changed" ? [event.to] : []));
    expect(states.toSorted()).toEqual(["applied", "discarded"]);
  });

  test("is idempotent across runs", async () => {
    const first = await importLinear(ctx, { team: "HNT", fetch: linearFetch(pages).fetch });
    expect(first.ok).toBe(true);
    const before = (await readEvents(ctx.dataDir ?? { path: "" })).length;
    await importLinear(ctx, { team: "HNT", fetch: linearFetch(pages).fetch });
    expect((await readEvents(ctx.dataDir ?? { path: "" })).length).toBe(before);
  });

  test("does not regress the state of a Lead that already existed locally", async () => {
    const seeded = await importLegacy(ctx, legacyDir);
    if (!seeded.ok) throw new Error(seeded.error.message);
    const dir = ctx.dataDir ?? { path: "" };
    const before = await readEvents(dir);
    const acmeKey = before.find((event) => event.key?.startsWith("acme|"))?.key ?? "";
    expect(foldState(before.filter((event) => event.key === acmeKey))).toBe("interviewing");
    const marked = issue("9", "Backend Engineer at Acme Corp", "In Progress", {
      description: `https://example.test/jobs/1\n\n[huntline-key: ${acmeKey}]`,
    });
    const result = await importLinear(ctx, { team: "HNT", fetch: linearFetch([[marked]]).fetch });
    if (!result.ok) throw new Error(result.error.message);
    const after = await readEvents(dir);
    expect(foldState(after.filter((event) => event.key === acmeKey))).toBe("interviewing");
  });

  test("requires the API key and sends it as authorization", async () => {
    const missing = await importLinear({ ...ctx, env: {} }, { team: "HNT" });
    expect(missing.ok).toBe(false);
    let seen = "";
    const spy: FetchLike = (_input, init) => {
      seen = new Headers(init.headers).get("authorization") ?? "";
      return linearFetch([[]]).fetch(_input, init);
    };
    await importLinear(ctx, { team: "HNT", project: "Search", fetch: spy });
    expect(seen).toBe("lin_synthetic_key");
  });

  test("surfaces HTTP failures", async () => {
    const result = await importLinear(ctx, { team: "HNT", fetch: failingFetch });
    expect(result.ok ? "" : result.error.code).toBe("migrate-linear-http");
  });
});

describe("importLinear title shapes", () => {
  test("accepts Company - Role and Role at Company", async () => {
    const pages = [
      [
        issue("21", "Acme - Backend Engineer", "Todo"),
        issue("22", "Backend Engineer at Acme", "Todo"),
      ],
    ];
    const result = await importLinear(ctx, { team: "HNT", fetch: linearFetch(pages).fetch });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings).toEqual([]);
    const leads = (await readEvents(ctx.dataDir ?? { path: "" })).filter(
      (event) => event.kind === "lead.created",
    );
    expect(leads).toHaveLength(1);
    const lead = leads[0];
    expect(lead?.kind === "lead.created" && [lead.posting.company, lead.posting.title]).toEqual([
      "Acme",
      "Backend Engineer",
    ]);
  });

  test("splitTitle handles both shapes", () => {
    expect(splitTitle("Acme - Backend Engineer")).toEqual({
      company: "Acme",
      role: "Backend Engineer",
    });
    expect(splitTitle("Backend Engineer at Acme")).toEqual({
      company: "Acme",
      role: "Backend Engineer",
    });
    expect(splitTitle("Untitled")).toEqual({ company: "", role: "Untitled" });
    expect(splitTitle("Backend Engineer - Payments at Acme")).toEqual({
      company: "Acme",
      role: "Backend Engineer - Payments",
    });
  });
});

describe("migrate command", () => {
  test("legacy prints a report envelope", async () => {
    const envelope = await run(["legacy", legacyDir], ctx);
    expect(envelope.ok).toBe(true);
  });

  test("rejects bad usage", async () => {
    expect((await run(["legacy"], ctx)).ok).toBe(false);
    expect((await run(["linear"], ctx)).ok).toBe(false);
    expect((await run(["bogus"], ctx)).ok).toBe(false);
  });
});

function writeLeads(content: string): string {
  const target = path.join(root, "legacy-ids");
  mkdirSync(path.join(target, "applications", "2026-05-02"), { recursive: true });
  writeFileSync(path.join(target, "applications", "2026-05-02", "leads.md"), content);
  return target;
}

async function allEvents(): Promise<Awaited<ReturnType<typeof readEvents>>> {
  return readEvents(ctx.dataDir ?? { path: "" });
}

function jobFetch(...issues: unknown[]): FetchLike {
  return linearFetch([issues]).fetch;
}

async function notes(): Promise<string[]> {
  return (await allEvents()).flatMap((event) => (event.kind === "note" ? [event.text] : []));
}

async function leadCount(): Promise<number> {
  return (await allEvents()).filter((event) => event.kind === "lead.created").length;
}

describe("legacy id linking", () => {
  const LEADS = `| Lead | Linear | Outcome | Detail |
| --- | --- | --- | --- |
| Acme Corp - Backend Engineer | AO-7 | applied | sent by email |
`;

  const acme = issue("12", "Backend Engineer at Acme Corp", "Todo", { identifier: "JOB-12" });

  test("links legacy then linear with exactly one note and one Lead", async () => {
    const legacy = await importLegacy(ctx, writeLeads(LEADS));
    expect(legacy.ok).toBe(true);
    const result = await importLinear(ctx, { team: "JOB", fetch: jobFetch(acme) });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings).toEqual([]);
    expect(await leadCount()).toBe(1);
    expect((await notes()).filter((text) => text === "legacy AO-7 = linear JOB-12")).toHaveLength(
      1,
    );
    const before = (await allEvents()).length;
    await importLinear(ctx, { team: "JOB", fetch: jobFetch(acme) });
    await importLegacy(ctx, writeLeads(LEADS));
    expect((await allEvents()).length).toBe(before);
  });

  test("links when linear runs before legacy", async () => {
    const linear = await importLinear(ctx, { team: "JOB", fetch: jobFetch(acme) });
    if (!linear.ok) throw new Error(linear.error.message);
    expect(linear.value.warnings).toEqual([]);
    await importLegacy(ctx, writeLeads(LEADS));
    expect(await leadCount()).toBe(1);
    expect((await notes()).filter((text) => text === "legacy AO-7 = linear JOB-12")).toHaveLength(
      1,
    );
    const before = (await allEvents()).length;
    await importLinear(ctx, { team: "JOB", fetch: jobFetch(acme) });
    expect((await allEvents()).length).toBe(before);
  });

  test("warns instead of noting when two legacy ids share one Linear issue", async () => {
    const two = `${LEADS}| Acme Corp - Backend Engineer | AO-8 | applied | again |\n`;
    await importLegacy(ctx, writeLeads(two));
    const result = await importLinear(ctx, { team: "JOB", fetch: jobFetch(acme) });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.some((warning) => warning.includes("AO-7, AO-8"))).toBe(true);
    expect((await notes()).some((text) => text.includes(" = linear "))).toBe(false);
  });

  test("warns when one legacy id matches several Linear issues", async () => {
    await importLegacy(ctx, writeLeads(LEADS));
    const other = issue("13", "Acme Corp - Backend Engineer", "Todo", { identifier: "JOB-13" });
    const result = await importLinear(ctx, { team: "JOB", fetch: jobFetch(acme, other) });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.some((warning) => warning.includes("several Linear issues"))).toBe(
      true,
    );
    expect((await notes()).some((text) => text.includes(" = linear "))).toBe(false);
  });

  test("lists legacy ids without a Linear match in one warning", async () => {
    const extra = `${LEADS}| Globex - Platform Engineer | AO-9 | applied | |\n`;
    await importLegacy(ctx, writeLeads(extra));
    const result = await importLinear(ctx, { team: "JOB", fetch: jobFetch(acme) });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings).toEqual(["legacy ids with no Linear match: AO-9"]);
  });
});
