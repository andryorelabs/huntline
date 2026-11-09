import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { HuntEvent, Posting } from "../core/types.ts";
import { run } from "./command.ts";
import { dedupKey, findDuplicate, ledgerRecord, readLedger } from "./dedup.ts";
import { appendEvent, eventsPath, readEvents } from "./events.ts";
import { foldState } from "./state.ts";

let dir = { path: "" };

beforeEach(() => {
  dir = { path: mkdtempSync(path.join(os.tmpdir(), "huntline-ledger-")) };
});

afterEach(() => {
  rmSync(dir.path, { recursive: true, force: true });
});

function posting(overrides: Partial<Posting> = {}): Posting {
  return {
    id: "1001",
    source: "greenhouse",
    url: "https://example.test/jobs/1001",
    company: "Acme Inc.",
    title: "Senior Backend Engineer",
    location: "Remote - LATAM",
    ...overrides,
  };
}

function event(kind: HuntEvent["kind"], extra: Record<string, unknown> = {}, id = "e"): HuntEvent {
  return { kind, id, at: "2026-01-01T00:00:00Z", key: "k", ...extra } as HuntEvent;
}

describe("foldState", () => {
  test("returns null without events", () => {
    expect(foldState([])).toBeNull();
  });

  test("lead.created yields lead and the last status.changed wins", () => {
    const events = [
      event("lead.created", { posting: posting(), eligibility: "unknown" }),
      event("status.changed", { to: "to-apply" }),
      event("status.changed", { from: "to-apply", to: "applied" }),
    ];
    expect(foldState(events)).toBe("applied");
  });

  test("dismissal alone yields discarded and is pure", () => {
    const events = [event("posting.dismissed", { posting: posting(), reason: "region" })];
    const snapshot = JSON.stringify(events);
    expect(foldState(events)).toBe("discarded");
    expect(JSON.stringify(events)).toBe(snapshot);
  });
});

describe("event log", () => {
  test("concurrent appends both land and status reflects the later one", async () => {
    await appendEvent(dir, { kind: "lead.created", key: "k", posting: posting(), eligibility: "unknown" });
    await Promise.all([
      appendEvent(dir, { kind: "status.changed", key: "k", to: "to-apply" }),
      appendEvent(dir, { kind: "status.changed", key: "k", from: "to-apply", to: "applied" }),
    ]);
    const events = await readEvents(dir, "k");
    expect(events).toHaveLength(3);
    const lines = readFileSync(eventsPath(dir), "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    const last = events[2];
    expect(foldState(events)).toBe(last?.kind === "status.changed" ? last.to : null);
  });

  test("append assigns id and timestamp and keeps earlier lines intact", async () => {
    const first = await appendEvent(dir, { kind: "note", key: "k", text: "one" });
    const before = readFileSync(eventsPath(dir), "utf8");
    await appendEvent(dir, { kind: "note", key: "k", text: "two" });
    expect(first.id).not.toBe("");
    expect(Number.isNaN(Date.parse(first.at))).toBe(false);
    expect(readFileSync(eventsPath(dir), "utf8").startsWith(before)).toBe(true);
  });

  test("readEvents filters by key", async () => {
    await appendEvent(dir, { kind: "note", key: "a", text: "x" });
    await appendEvent(dir, { kind: "note", key: "b", text: "y" });
    expect(await readEvents(dir, "a")).toHaveLength(1);
    expect(await readEvents(dir)).toHaveLength(2);
  });
});

describe("dedup", () => {
  test("canonical id for ATS sources, normalized key otherwise", () => {
    expect(dedupKey(posting())).toBe("greenhouse:1001");
    expect(dedupKey(posting({ source: "himalayas", id: "h1" }))).toBe("acme|senior backend engineer|latam");
  });

  test("same role from Greenhouse then Himalayas is a duplicate", async () => {
    await ledgerRecord(dir, posting(), "seen");
    const other = posting({
      source: "himalayas",
      id: "h-77",
      company: "ACME",
      title: "Senior Backend Engineer (Remote)",
      location: "LATAM",
    });
    const match = await findDuplicate(dir, other);
    expect(match).not.toBeNull();
    expect(match?.matchedBy).toBe("fuzzy");
  });

  test("exact key matches", async () => {
    await ledgerRecord(dir, posting(), "seen");
    expect((await findDuplicate(dir, posting()))?.matchedBy).toBe("exact");
  });

  test("different roles at the same company are never merged", async () => {
    await ledgerRecord(dir, posting(), "seen");
    const titles = [
      "Senior Frontend Engineer",
      "Staff Backend Engineer",
      "Backend Engineer",
      "Senior Backend Engineer II",
      "Senior Data Engineer",
    ];
    const matches = await Promise.all(
      titles.map((title) => findDuplicate(dir, posting({ source: "himalayas", id: title, title }))),
    );
    expect(matches.every((match) => match === null)).toBe(true);
  });

  test("same title at a different company is not merged", async () => {
    await ledgerRecord(dir, posting(), "seen");
    expect(await findDuplicate(dir, posting({ source: "himalayas", id: "z", company: "Globex" }))).toBeNull();
  });

  test("fuzzy match respects the window", async () => {
    await ledgerRecord(dir, posting({ postedAt: "2025-01-01T00:00:00Z" }), "seen");
    const later = posting({ source: "himalayas", id: "h", postedAt: "2026-01-01T00:00:00Z" });
    expect(await findDuplicate(dir, later)).toBeNull();
  });

  test("dismissed postings are remembered", async () => {
    await ledgerRecord(dir, posting(), "dismissed", "region");
    const match = await findDuplicate(dir, posting());
    expect(match?.dismissed).toBe(true);
    const entries = await readLedger(dir);
    expect(entries[0]?.reason).toBe("region");
  });

  test("leads from the event log count as known postings", async () => {
    await appendEvent(dir, { kind: "lead.created", key: "k", posting: posting(), eligibility: "unknown" });
    const match = await findDuplicate(dir, posting({ source: "himalayas", id: "h" }));
    expect(match?.source).toBe("events");
    expect(match?.key).toBe("k");
  });
});

function ctx(): { dataDir: { path: string }; env: Record<string, string>; cwd: string } {
  return { dataDir: dir, env: {}, cwd: dir.path };
}

describe("command", () => {
  test("events append, list and status", async () => {
    const lead = JSON.stringify({ kind: "lead.created", key: "k", posting: posting(), eligibility: "unknown" });
    expect((await run(["events", "append", "--json", lead], ctx())).ok).toBe(true);
    await run(["events", "append", "--json", JSON.stringify({ kind: "status.changed", key: "k", to: "applied" })], ctx());
    const listed = await run(["events", "list", "--key", "k"], ctx());
    expect(listed.ok && listed.data).toMatchObject({ count: 2 });
    const status = await run(["status", "k"], ctx());
    expect(status.ok && status.data).toEqual({ key: "k", state: "applied" });
  });

  test("rejects malformed input and unknown keys", async () => {
    const bad = await run(["events", "append", "--json", "{"], ctx());
    expect(!bad.ok && bad.error.code).toBe("usage");
    const noKind = await run(["events", "append", "--json", "{}"], ctx());
    expect(noKind.ok).toBe(false);
    const missing = await run(["status", "nope"], ctx());
    expect(!missing.ok && missing.error.code).toBe("not-found");
  });

  test("ledger check reports a duplicate", async () => {
    await ledgerRecord(dir, posting(), "dismissed", "region");
    const checked = await run(["ledger", "check", "--json", JSON.stringify(posting())], ctx());
    expect(checked.ok && checked.data).toMatchObject({ duplicate: true });
    const listed = await run(["ledger", "list"], ctx());
    expect(listed.ok && listed.data).toMatchObject({ count: 1 });
  });

  test("fails without a data dir", async () => {
    const result = await run(["status", "k"], { dataDir: null, env: {}, cwd: dir.path });
    expect(!result.ok && result.error.code).toBe("data-dir-not-found");
  });
});
