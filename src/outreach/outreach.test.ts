import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { exitCodeFor } from "../core/envelope.ts";
import type { Profile } from "../core/types.ts";
import { readEvents } from "../ledger/events.ts";
import { run } from "./command.ts";
import { lintDraft } from "./lint.ts";
import { logOutreach } from "./log.ts";

const ctx = { recipient: { name: "Ada Example" }, company: "Acme" };

const profile: Profile = {
  regions: [],
  contractTypes: ["full-time"],
  remote: "any",
  stack: { include: [], exclude: [] },
  salaryFloor: null,
  excludedCompanies: [],
  outreachDailyCap: 2,
  sources: [],
  tracker: { kind: "local" },
};

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "outreach-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("lintDraft", () => {
  test("320-character LinkedIn Draft fails, 300 passes", () => {
    const long = lintDraft({ channel: "linkedin", body: `Hi Ada ${"x".repeat(313)}` }, ctx);
    expect(long.map((finding) => finding.rule)).toEqual(["too-long"]);
    expect(lintDraft({ channel: "linkedin", body: `Hi Ada ${"x".repeat(293)}` }, ctx)).toEqual([]);
  });

  test("email over 160 words fails", () => {
    const body = `Hi Ada ${Array.from({ length: 160 }, () => "word").join(" ")}`;
    expect(lintDraft({ channel: "email", body }, ctx).map((finding) => finding.rule)).toEqual([
      "too-long",
    ]);
    const ok = `Hi Ada ${Array.from({ length: 150 }, () => "word").join(" ")}`;
    expect(lintDraft({ channel: "email", body: ok }, ctx)).toEqual([]);
  });

  test("reports placeholders and stock phrases", () => {
    const findings = lintDraft(
      {
        channel: "email",
        body: "Hi Ada, I hope this message finds you well. [Company] needs {{role}}.",
      },
      ctx,
    );
    const rules = findings.map((finding) => finding.rule);
    expect(rules.filter((rule) => rule === "placeholder")).toHaveLength(2);
    expect(rules).toContain("stock-phrase");
  });

  test("reports wrong recipient name and company", () => {
    const findings = lintDraft(
      { channel: "linkedin", body: "Hi Grace, loved your talk.", company: "Globex" },
      ctx,
    );
    expect(findings.map((finding) => finding.rule).toSorted()).toEqual(["wrong-company", "wrong-name"]);
  });

  test("matching greeting is accepted, accents ignored", () => {
    expect(
      lintDraft(
        { channel: "linkedin", body: "Hola Adá" },
        { recipient: { name: "Ada X" }, company: "Acme" },
      ),
    ).toEqual([]);
  });
});

describe("logOutreach and CLI", () => {
  test("concurrent logs never exceed the daily cap", async () => {
    const dir = { path: root };
    const entry = { channel: "email", recipient: "Ada" } as const;
    const results = await Promise.all(Array.from({ length: 6 }, () => logOutreach(dir, profile, entry)));
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    const logged = (await readEvents(dir)).filter((event) => event.kind === "outreach.logged");
    expect(logged).toHaveLength(2);
  });

  test("refuses once the daily cap is reached", async () => {
    const dir = { path: root };
    const entry = { channel: "email", recipient: "Ada" } as const;
    expect((await logOutreach(dir, profile, entry)).ok).toBe(true);
    expect((await logOutreach(dir, profile, entry)).ok).toBe(true);
    const third = await logOutreach(dir, profile, entry);
    expect(third.ok === false && third.error.code).toBe("daily-cap-reached");
    const logged = (await readEvents(dir)).filter((event) => event.kind === "outreach.logged");
    expect(logged).toHaveLength(2);
  });

  test("outreach lint exits 1 on a long Draft", async () => {
    writeFileSync(path.join(root, "draft.txt"), `Hi Ada ${"x".repeat(320)}`);
    const envelope = await run(
      [
        "lint",
        "--channel",
        "linkedin",
        "--recipient",
        "Ada Example",
        "--company",
        "Acme",
        "--file",
        "draft.txt",
      ],
      { dataDir: { path: root }, env: {}, cwd: root },
    );
    expect(exitCodeFor(envelope)).toBe(1);
  });

  test("outreach log exits 1 at the cap", async () => {
    writeFileSync(
      path.join(root, "profile.yaml"),
      JSON.stringify({ ...profile, outreachDailyCap: 1 }),
    );
    const context = { dataDir: { path: root }, env: {}, cwd: root };
    const argv = ["log", "--channel", "linkedin", "--recipient", "Ada"];
    expect(exitCodeFor(await run(argv, context))).toBe(0);
    expect(exitCodeFor(await run(argv, context))).toBe(1);
  });
});
