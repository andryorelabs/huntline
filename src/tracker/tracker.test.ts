import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { IdempotencyMap } from "../core/approval.ts";
import { isObject } from "../core/narrow.ts";
import type { HuntEvent, Posting } from "../core/types.ts";
import { appendEvent, readEvents } from "../ledger/events.ts";
import { createTracker, projectEvents } from "./index.ts";
import { createLinearTracker, type FetchLike } from "./linear.ts";
import fixture from "./linear-fixture.json";

const API_KEY = "lin_api_synthetic_secret_key";

let dir = { path: "" };

beforeEach(() => {
  dir = { path: mkdtempSync(path.join(os.tmpdir(), "jobship-tracker-")) };
});

afterEach(() => {
  rmSync(dir.path, { recursive: true, force: true });
});

const posting: Posting = {
  id: "1001",
  source: "greenhouse",
  url: "https://example.test/jobs/1001",
  company: "Acme Inc.",
  title: "Senior Backend Engineer",
};

const STAMP = { at: "2026-01-01T00:00:00Z", key: "acme|senior-backend" } as const;

const noteEvent: HuntEvent = { ...STAMP, id: "e4", kind: "note", text: "referred by a friend" };

const events: HuntEvent[] = [
  { ...STAMP, id: "e1", kind: "lead.created", posting, eligibility: "eligible" },
  {
    ...STAMP,
    id: "e2",
    kind: "score.recorded",
    score: 82,
    reasons: ["stack match"],
    liveness: "live",
  },
  { ...STAMP, id: "e3", kind: "status.changed", from: "lead", to: "applied" },
  noteEvent,
];

type Call = { operation: string; variables: Record<string, unknown>; authorization: string };

function requestOf(init: RequestInit): { query: string; variables: Record<string, unknown> } {
  if (typeof init.body !== "string") throw new Error("expected a string request body");
  const parsed: unknown = JSON.parse(init.body);
  if (!isObject(parsed)) throw new Error("request body is not an object");
  const { query, variables } = parsed;
  if (typeof query !== "string") throw new Error("request body has no query");
  return { query, variables: isObject(variables) ? variables : {} };
}

function createInputOf(calls: Call[]): Record<string, unknown> {
  const input = calls.find((call) => call.operation === "CreateIssue")?.variables["input"];
  if (!isObject(input)) throw new Error("no CreateIssue input was recorded");
  return input;
}

function recordedFetch(): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const responses: Record<string, unknown> = fixture;
  const fetchImpl: FetchLike = (_input, init) => {
    const body = requestOf(init);
    const operation = /(?:query|mutation) (\w+)/.exec(body.query)?.[1] ?? "";
    calls.push({
      operation,
      variables: body.variables,
      authorization: new Headers(init.headers).get("authorization") ?? "",
    });
    return Promise.resolve(
      Response.json(responses[operation] ?? { errors: [{ message: "unrecorded" }] }),
    );
  };
  return { fetch: fetchImpl, calls };
}

const erroring: FetchLike = () => Promise.resolve(Response.json({ errors: [{ message: "boom" }] }));

async function titleFor(
  titleFormat: "role-at-company" | "company-role" | undefined,
): Promise<string> {
  const { fetch: fetchImpl, calls } = recordedFetch();
  const tracker = createTracker(
    { kind: "linear", team: "HNT", ...(titleFormat === undefined ? {} : { titleFormat }) },
    { path: mkdtempSync(path.join(dir.path, "t-")) },
    { apiKey: API_KEY, fetch: fetchImpl },
  );
  await tracker.upsertLead({
    key: "k",
    posting: { ...posting, company: "Acme", title: "Backend Engineer" },
    eligibility: "eligible",
  });
  return String(createInputOf(calls)["title"]);
}

describe("local tracker", () => {
  test("writes frontmatter and an Events section atomically", async () => {
    await appendEvent(dir, {
      kind: "score.recorded",
      key: "acme|senior-backend",
      score: 82,
      reasons: [],
      liveness: "live",
    });
    const tracker = createTracker({ kind: "local" }, dir);
    const result = await projectEvents(tracker, dir, events);
    expect(result).toEqual({ ok: true, value: { created: 1, updated: 0 } });

    const directory = path.join(dir.path, "applications");
    const files = readdirSync(directory);
    expect(files).toHaveLength(1);
    expect(files.some((name) => name.endsWith(".tmp"))).toBe(false);
    const content = readFileSync(path.join(directory, files[0] ?? ""), "utf8");
    expect(content).toContain('url: "https://example.test/jobs/1001"');
    expect(content).toContain('source: "greenhouse"');
    expect(content).toContain("score: 82");
    expect(content).toContain('dedup_key: "acme|senior-backend"');
    expect(content).toContain("rejection_reason: null");
    expect(content).toContain('status: "applied"');
    expect(content).toContain("## Events");
    expect(content).toContain("- status: applied");
    expect(content).toContain("- note: referred by a friend");
    expect((await readEvents(dir)).length).toBe(1);
  });

  test("records the rejection reason from a dismissal", async () => {
    await appendEvent(dir, {
      kind: "posting.dismissed",
      key: "acme|senior-backend",
      posting,
      reason: "salary",
    });
    const tracker = createTracker({ kind: "local", directory: "tracker-files" }, dir);
    await projectEvents(tracker, dir, events);
    const content = readFileSync(
      path.join(
        dir.path,
        "tracker-files",
        readdirSync(path.join(dir.path, "tracker-files"))[0] ?? "",
      ),
      "utf8",
    );
    expect(content).toContain('rejection_reason: "salary"');
  });

  test("projecting twice does not duplicate Events lines", async () => {
    const tracker = createTracker({ kind: "local" }, dir);
    await projectEvents(tracker, dir, events);
    const again = await projectEvents(tracker, dir, events);
    expect(again).toEqual({ ok: true, value: { created: 0, updated: 0 } });
    const directory = path.join(dir.path, "applications");
    const content = readFileSync(path.join(directory, readdirSync(directory)[0] ?? ""), "utf8");
    expect(content.match(/- status: applied/g)).toHaveLength(1);
  });

  test("a new Event after projection counts as an update", async () => {
    const tracker = createTracker({ kind: "local" }, dir);
    await projectEvents(tracker, dir, events);
    const next: HuntEvent[] = [
      ...events,
      { ...STAMP, id: "e5", kind: "status.changed", from: "applied", to: "screening" },
    ];
    expect(await projectEvents(tracker, dir, next)).toEqual({
      ok: true,
      value: { created: 0, updated: 1 },
    });
  });

  test("ignores events without a lead", async () => {
    const tracker = createTracker({ kind: "local" }, dir);
    const result = await projectEvents(tracker, dir, [noteEvent]);
    expect(result).toEqual({ ok: true, value: { created: 0, updated: 0 } });
    expect(existsSync(path.join(dir.path, "applications"))).toBe(false);
  });
});

describe("linear tracker", () => {
  test("projecting twice creates no duplicate issues", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const tracker = createTracker({ kind: "linear", team: "HNT" }, dir, {
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    const first = await projectEvents(tracker, dir, events);
    expect(first).toEqual({ ok: true, value: { created: 1, updated: 0 } });
    const second = await projectEvents(tracker, dir, events);
    expect(second).toEqual({ ok: true, value: { created: 0, updated: 0 } });
    expect(calls.filter((call) => call.operation === "CreateIssue")).toHaveLength(1);
    expect(calls.filter((call) => call.operation === "Comment")).toHaveLength(2);
  });

  test("the lookup marker is delimited so one key never matches a longer key", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const tracker = createTracker({ kind: "linear", team: "HNT" }, dir, {
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    await tracker.find("greenhouse:1001");
    const lookup = calls.find((call) => call.operation === "FindIssue");
    const marker = String(lookup?.variables["marker"]);
    expect(marker).toBe("[huntline-key: greenhouse:1001]");
    expect("[huntline-key: greenhouse:10012]".includes(marker)).toBe(false);
  });

  test("a fresh adapter reuses the idempotency map", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const config = { kind: "linear", team: "HNT" } as const;
    await projectEvents(
      createTracker(config, dir, { apiKey: API_KEY, fetch: fetchImpl }),
      dir,
      events,
    );
    const again = createTracker(config, dir, { apiKey: API_KEY, fetch: fetchImpl });
    const found = await again.find("acme|senior-backend");
    expect(found).toEqual({ ok: true, value: "issue-1" });
    expect(calls.filter((call) => call.operation === "CreateIssue")).toHaveLength(1);
  });

  test("maps status to the configured state and the source to a channel label", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const tracker = createTracker({ kind: "linear", team: "HNT" }, dir, {
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    await projectEvents(tracker, dir, events);
    const input = createInputOf(calls);
    expect(input["stateId"]).toBe("st-backlog");
    expect(input["labelIds"]).toEqual(["lb-new"]);
    expect(calls.find((call) => call.operation === "CreateLabel")?.variables["name"]).toBe(
      "channel:greenhouse",
    );
    const update = calls.find((call) => call.operation === "UpdateIssue");
    expect(update?.variables).toEqual({ id: "issue-1", input: { stateId: "st-progress" } });
  });

  test("a configured states map creates the Lead in the named state", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const tracker = createTracker(
      { kind: "linear", team: "HNT", states: { lead: "Lead", applied: "Applied" } },
      dir,
      { apiKey: API_KEY, fetch: fetchImpl },
    );
    await tracker.upsertLead({ key: "k", posting, eligibility: "eligible" });
    const input = createInputOf(calls);
    expect(input["stateId"]).toBe("st-lead");
    const unmapped = await tracker.setStatus("k", "hired");
    expect(unmapped.ok).toBe(true);
    const update = calls.findLast((call) => call.operation === "UpdateIssue");
    expect(update?.variables["input"]).toEqual({ stateId: "st-done" });
  });

  test("a channelLabels entry is used verbatim without a duplicate label", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const tracker = createTracker(
      { kind: "linear", team: "HNT", channelLabels: { linkedin: "channel:linkedin" } },
      dir,
      { apiKey: API_KEY, fetch: fetchImpl },
    );
    await tracker.upsertLead({
      key: "k",
      posting: { ...posting, source: "linkedin" },
      eligibility: "eligible",
    });
    const input = createInputOf(calls);
    expect(input["labelIds"]).toEqual(["lb-existing"]);
    expect(calls.some((call) => call.operation === "CreateLabel")).toBe(false);
  });

  test("channelLabelPrefix applies to sources without an entry", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const tracker = createTracker(
      { kind: "linear", team: "HNT", channelLabelPrefix: "via:" },
      dir,
      {
        apiKey: API_KEY,
        fetch: fetchImpl,
      },
    );
    await tracker.upsertLead({ key: "k", posting, eligibility: "eligible" });
    expect(calls.find((call) => call.operation === "CreateLabel")?.variables["name"]).toBe(
      "via:greenhouse",
    );
  });

  test("titleFormat selects the issue title shape", async () => {
    const titles = await Promise.all([
      titleFor(undefined),
      titleFor("role-at-company"),
      titleFor("company-role"),
    ]);
    expect(titles).toEqual([
      "Backend Engineer at Acme",
      "Backend Engineer at Acme",
      "Acme - Backend Engineer",
    ]);
  });

  test("reuses an existing channel label", async () => {
    const { fetch: fetchImpl, calls } = recordedFetch();
    const tracker = createLinearTracker({
      apiKey: API_KEY,
      team: "HNT",
      idempotency: new IdempotencyMap(path.join(dir.path, "map.json")),
      fetch: fetchImpl,
    });
    await tracker.upsertLead({
      key: "k",
      posting: { ...posting, source: "linkedin" },
      eligibility: "eligible",
    });
    expect(calls.some((call) => call.operation === "CreateLabel")).toBe(false);
  });

  test("sends the key only in the authorization header and never leaks it in errors", async () => {
    const failing: FetchLike = () => Promise.reject(new Error(`connect failed for ${API_KEY}`));
    const tracker = createLinearTracker({
      apiKey: API_KEY,
      team: "HNT",
      idempotency: new IdempotencyMap(path.join(dir.path, "map.json")),
      fetch: failing,
    });
    const result = await tracker.find("k");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(API_KEY);

    const { fetch: fetchImpl, calls } = recordedFetch();
    const working = createLinearTracker({
      apiKey: API_KEY,
      team: "HNT",
      idempotency: new IdempotencyMap(path.join(dir.path, "map2.json")),
      fetch: fetchImpl,
    });
    await working.find("k");
    expect(calls[0]?.authorization).toBe(API_KEY);
  });

  test("fails without a key or a team", async () => {
    const noKey = createTracker({ kind: "linear", team: "HNT" }, dir, { apiKey: undefined });
    const keyResult = await noKey.find("k");
    expect(keyResult.ok).toBe(false);
    const { fetch: fetchImpl } = recordedFetch();
    const noTeam = createTracker({ kind: "linear" }, dir, { apiKey: API_KEY, fetch: fetchImpl });
    const teamResult = await noTeam.find("k");
    expect(teamResult.ok).toBe(false);
  });

  test("surfaces GraphQL errors", async () => {
    const tracker = createLinearTracker({
      apiKey: API_KEY,
      team: "HNT",
      idempotency: new IdempotencyMap(path.join(dir.path, "map.json")),
      fetch: erroring,
    });
    const result = await tracker.find("k");
    expect(result).toEqual({
      ok: false,
      error: { code: "tracker-linear-graphql", message: "boom" },
    });
  });
});
