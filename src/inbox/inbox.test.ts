import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isObject } from "../core/narrow.ts";
import { exitCodeFor } from "../core/envelope.ts";
import type { CommandContext } from "../core/commands.ts";
import type { Posting } from "../core/types.ts";
import { appendEvent, readEvents } from "../ledger/events.ts";
import { foldState } from "../ledger/state.ts";
import { applyBatch, proposeBatch } from "./batch.ts";
import { run } from "./command.ts";
import { isAtsDomain, matchEmail } from "./match.ts";
import type { ClassifiedEmail } from "./types.ts";

let dir = { path: "" };

const PROFILE = {
  regions: ["latam"],
  contractTypes: ["full-time"],
  remote: "remote-only",
  stack: { include: [], exclude: [] },
  salaryFloor: null,
  excludedCompanies: [],
  outreachDailyCap: 5,
  sources: [],
  tracker: { kind: "local" },
};

function readMap(mapPath: string): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(mapPath, "utf8"));
  if (!isObject(parsed)) throw new Error("map is not an object");
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
}

beforeEach(() => {
  dir = { path: mkdtempSync(path.join(os.tmpdir(), "jobship-inbox-")) };
  writeFileSync(path.join(dir.path, "profile.yaml"), JSON.stringify(PROFILE));
});

afterEach(() => {
  rmSync(dir.path, { recursive: true, force: true });
});

function context(): CommandContext {
  return { dataDir: dir, env: {}, cwd: dir.path };
}

function posting(company: string): Posting {
  return {
    id: company,
    source: "greenhouse",
    url: `https://example.test/${company}`,
    company,
    title: "Backend Engineer",
  };
}

async function seedLead(key: string, company: string): Promise<void> {
  await appendEvent(dir, {
    kind: "lead.created",
    key,
    posting: posting(company),
    eligibility: "eligible",
  });
  await appendEvent(dir, { kind: "status.changed", key, from: "lead", to: "applied" });
}

function email(overrides: Partial<ClassifiedEmail> = {}): ClassifiedEmail {
  return {
    messageId: "m1",
    threadId: "t1",
    from: "Recruiting <jobs@acme.test>",
    subject: "Your application",
    classification: "rejection",
    ...overrides,
  };
}

describe("matching", () => {
  test("ATS vendor domains are recognized", () => {
    expect(isAtsDomain("us.greenhouse-mail.io")).toBe(true);
    expect(isAtsDomain("greenhouse.io")).toBe(true);
    expect(isAtsDomain("jobs.lever.co")).toBe(true);
    expect(isAtsDomain("acme.test")).toBe(false);
  });

  test("sender domain of an ATS vendor never matches a company by itself", () => {
    const apps = [{ key: "greenhouse|dev", company: "Greenhouse", state: "applied" as const }];
    const change = matchEmail(
      email({ from: "no-reply@greenhouse.io", subject: "Update" }),
      apps,
      new Map(),
    );
    expect(change.key).toBeNull();
    expect(change.confirmed).toBe(false);
  });

  test("ATS-relayed mail with the company in the sender name is unconfirmed", () => {
    const apps = [{ key: "acme|dev", company: "Acme Inc.", state: "applied" as const }];
    const change = matchEmail(
      email({ from: "Acme via Greenhouse <no-reply@greenhouse.io>" }),
      apps,
      new Map(),
    );
    expect(change.key).toBe("acme|dev");
    expect(change.band).toBe("medium");
    expect(change.confirmed).toBe(false);
  });

  test("company domain is a confirmed high match", () => {
    const apps = [{ key: "acme|dev", company: "Acme Inc.", state: "applied" as const }];
    const change = matchEmail(email(), apps, new Map());
    expect(change).toMatchObject({
      key: "acme|dev",
      band: "high",
      reason: "sender-domain",
      confirmed: true,
    });
    expect(change.targetState).toBe("rejected");
  });

  test("never proposes a regression or a transition for a never-applied Lead", () => {
    const interview = email({ classification: "interview" });
    const regress = matchEmail(
      interview,
      [{ key: "acme|dev", company: "Acme Inc.", state: "offer" as const }],
      new Map(),
    );
    expect(regress.targetState).toBeNull();
    const lead = matchEmail(
      email({ classification: "rejection" }),
      [{ key: "acme|dev", company: "Acme Inc.", state: "lead" as const }],
      new Map(),
    );
    expect(lead.targetState).toBeNull();
    const forward = matchEmail(
      interview,
      [{ key: "acme|dev", company: "Acme Inc.", state: "applied" as const }],
      new Map(),
    );
    expect(forward.targetState).toBe("interviewing");
  });

  test("thread match wins over everything", () => {
    const apps = [{ key: "other|dev", company: "Other", state: "applied" as const }];
    const change = matchEmail(email(), apps, new Map([["t1", "other|dev"]]));
    expect(change).toMatchObject({ key: "other|dev", reason: "thread", confirmed: true });
  });

  test("two applications at the same company are ambiguous, not guessed", () => {
    const apps = [
      { key: "acme|a", company: "Acme", state: "applied" as const },
      { key: "acme|b", company: "Acme", state: "applied" as const },
    ];
    const change = matchEmail(email(), apps, new Map());
    expect(change.key).toBeNull();
    expect(change.reason).toBe("ambiguous");
    expect(change.candidates).toEqual(["acme|a", "acme|b"]);
    expect(change.confirmed).toBe(false);
  });
});

describe("propose and apply", () => {
  test("records a relative key, honours a legacy key and resolves from another cwd", async () => {
    await seedLead("acme|dev", "Acme Inc.");
    const proposed = await proposeBatch(context(), [email()]);
    if (!proposed.ok) throw new Error(proposed.error.message);
    const relative = path.relative(dir.path, proposed.value.batchPath).split(path.sep).join("/");
    const mapPath = path.join(dir.path, "inbox-batches.json");
    const recorded = readMap(mapPath);
    expect(Object.keys(recorded)).toEqual([relative]);
    writeFileSync(mapPath, JSON.stringify({ [proposed.value.batchPath]: proposed.value.hash }));
    const elsewhere = { dataDir: dir, env: {}, cwd: path.dirname(dir.path) };
    const applied = await applyBatch(
      elsewhere,
      path.relative(elsewhere.cwd, proposed.value.batchPath),
    );
    expect(applied.ok).toBe(true);
  });

  test("edited batch is refused with batch-changed", async () => {
    await seedLead("acme|dev", "Acme Inc.");
    const proposed = await proposeBatch(context(), [email()]);
    if (!proposed.ok) throw new Error(proposed.error.message);
    const original = readFileSync(proposed.value.batchPath, "utf8");
    writeFileSync(proposed.value.batchPath, original.replace("rejected", "offer"));
    const envelope = await run(["apply", proposed.value.batchPath], context());
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) expect(envelope.error.code).toBe("batch-changed");
    expect(exitCodeFor(envelope)).toBe(1);
    expect((await readEvents(dir)).some((event) => event.kind === "email.classified")).toBe(false);
  });

  test("apply writes events and is a no-op on re-run", async () => {
    await seedLead("acme|dev", "Acme Inc.");
    const proposed = await proposeBatch(context(), [email()]);
    if (!proposed.ok) throw new Error(proposed.error.message);
    const first = await applyBatch(context(), proposed.value.batchPath);
    expect(first).toEqual({ ok: true, value: { applied: 1 } });
    const afterFirst = await readEvents(dir);
    expect(foldState(afterFirst.filter((event) => event.key === "acme|dev"))).toBe("rejected");
    const second = await applyBatch(context(), proposed.value.batchPath);
    expect(second).toEqual({ ok: true, value: { applied: 0 } });
    expect(await readEvents(dir)).toHaveLength(afterFirst.length);
  });

  test("processed message ids are skipped by propose", async () => {
    await seedLead("acme|dev", "Acme Inc.");
    const first = await proposeBatch(context(), [email()]);
    if (!first.ok) throw new Error(first.error.message);
    await applyBatch(context(), first.value.batchPath);
    const second = await proposeBatch(context(), [
      email(),
      email({ messageId: "m2", classification: "interview" }),
    ]);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.items.map((item) => item.messageId)).toEqual(["m2"]);
  });

  test("thread learned at apply matches later mail from an ATS relay", async () => {
    await seedLead("acme|dev", "Acme Inc.");
    const first = await proposeBatch(context(), [email()]);
    if (!first.ok) throw new Error(first.error.message);
    await applyBatch(context(), first.value.batchPath);
    const later = await proposeBatch(context(), [
      email({
        messageId: "m3",
        from: "no-reply@greenhouse.io",
        subject: "Re: update",
        classification: "interview",
      }),
    ]);
    if (!later.ok) throw new Error(later.error.message);
    expect(later.value.items[0]).toMatchObject({
      key: "acme|dev",
      reason: "thread",
      confirmed: true,
    });
  });

  test("unconfirmed items are not applied", async () => {
    await seedLead("acme|dev", "Acme Inc.");
    const proposed = await proposeBatch(context(), [
      email({ from: "x@unrelated.test", subject: "Hello" }),
    ]);
    if (!proposed.ok) throw new Error(proposed.error.message);
    expect(proposed.value.items[0]?.confirmed).toBe(false);
    const applied = await applyBatch(context(), proposed.value.batchPath);
    expect(applied).toEqual({ ok: true, value: { applied: 0 } });
  });
});

describe("command", () => {
  test("rejects unknown subcommands and missing files", async () => {
    const unknown = await run(["bogus"], context());
    expect(exitCodeFor(unknown)).toBe(2);
    const missing = await run(["propose"], context());
    expect(exitCodeFor(missing)).toBe(2);
  });

  test("propose reads a classified emails file", async () => {
    await seedLead("acme|dev", "Acme Inc.");
    writeFileSync(path.join(dir.path, "emails.json"), JSON.stringify([email()]));
    const envelope = await run(["propose", "--emails", "emails.json"], context());
    expect(envelope.ok).toBe(true);
    if (envelope.ok) expect(envelope.data).toMatchObject({ confirmed: 1, unconfirmed: 0 });
  });
});
