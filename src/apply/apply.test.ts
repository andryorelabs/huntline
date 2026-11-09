import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { lookupAnswer, saveAnswer } from "./answers.ts";
import { listNeeds, recordBlocker } from "./blockers.ts";
import { verifyFields } from "./verify.ts";

const cliPath = path.join(import.meta.dir, "../cli.ts");
let workDir = "";

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "huntline-apply-"));
  writeFileSync(path.join(workDir, "huntline.json"), '{"version":1}\n');
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function cli(args: string[]): { code: number; envelope: Record<string, unknown> } {
  const result = Bun.spawnSync([process.execPath, cliPath, ...args, "--data", workDir], {
    cwd: workDir,
    env: { PATH: process.env["PATH"] ?? "", HOME: workDir },
  });
  const lines = result.stdout.toString().split("\n").filter((line) => line !== "");
  expect(lines).toHaveLength(1);
  return { code: result.exitCode, envelope: JSON.parse(lines[0] ?? "") as Record<string, unknown> };
}

describe("answer bank", () => {
  test("abstains with no answer and returns saved answer with provenance", async () => {
    const dir = { path: workDir };
    expect(lookupAnswer(dir, "Expected salary?", "acme").status).toBe("abstain");
    expect((await saveAnswer(dir, "Expected salary?", "acme", "90k", "human 2026-11-09")).ok).toBe(true);
    expect(lookupAnswer(dir, "expected  salary", "acme")).toEqual({
      status: "answer",
      text: "90k",
      provenance: "human 2026-11-09",
    });
    expect(lookupAnswer(dir, "Expected salary?", "other").status).toBe("abstain");
  });

  test("global answers apply to any scope", async () => {
    const dir = { path: workDir };
    await saveAnswer(dir, "Work authorization", "global", "yes", "profile");
    expect(lookupAnswer(dir, "work authorization?", "acme").status).toBe("answer");
  });

  test("rejects empty provenance", async () => {
    expect((await saveAnswer({ path: workDir }, "q", "global", "a", " ")).ok).toBe(false);
  });
});

describe("answer list and blocker closing", () => {
  test("list returns saved answers with scope and provenance", () => {
    cli(["apply", "answer", "Notice period?", "--save", "2 weeks", "--provenance", "human"]);
    cli(["apply", "answer", "Visa?", "--scope", "acme", "--save", "no", "--provenance", "profile"]);
    const listed = cli(["apply", "answer", "--list"]);
    const data = listed.envelope["data"] as { answers: Record<string, string>[] };
    expect(data.answers).toHaveLength(2);
    expect(data.answers).toContainEqual(expect.objectContaining({ scope: "acme", provenance: "profile" }));
    expect(data.answers).toContainEqual(expect.objectContaining({ scope: "global", provenance: "human" }));
  });

  test("saving closes matching open field blockers only", async () => {
    const dir = { path: workDir };
    await recordBlocker(dir, "acme-1", "field", "no answer for: How soon can you start?");
    await recordBlocker(dir, "acme-1", "field", "no answer for: Visa?");
    await recordBlocker(dir, "acme-1", "section", "no answer for: How soon can you start?");
    const saved = await saveAnswer(dir, "how soon can you start", "global", "now", "human");
    expect(saved.ok).toBe(true);
    const groups = await listNeeds(dir);
    expect(groups.flatMap((group) => group.items.map((item) => `${group.scope}:${item.detail}`)).toSorted()).toEqual([
      "field:no answer for: Visa?",
      "section:no answer for: How soon can you start?",
    ]);
  });
});

describe("lever reference", () => {
  test("orders text fields, CV upload last, then snapshot read-back", () => {
    const text = readFileSync(path.join(import.meta.dir, "../../skills/apply/references/lever.md"), "utf8");
    const textFields = text.indexOf("fill the text fields first");
    const upload = text.indexOf("upload the CV last");
    const snapshot = text.indexOf("snapshot rather than a script");
    expect(textFields).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(textFields);
    expect(snapshot).toBeGreaterThan(upload);
  });
});

describe("verifyFields", () => {
  test("reports value, missing and file name mismatches", () => {
    const findings = verifyFields(
      [
        { name: "email", kind: "text", value: "a@example.com" },
        { name: "city", kind: "text", value: "Lima" },
        { name: "cv", kind: "file", value: "/tmp/cv-acme.pdf" },
        { name: "ok", kind: "text", value: "same" },
      ],
      [
        { name: "email", value: "b@example.com" },
        { name: "cv", value: "C:\\fakepath\\resume.pdf" },
        { name: "ok", value: "same" },
      ],
    );
    expect(findings.map((finding) => [finding.field, finding.class])).toEqual([
      ["email", "value-mismatch"],
      ["city", "missing"],
      ["cv", "file-name-mismatch"],
    ]);
  });

  test("passes a file with the same base name", () => {
    expect(
      verifyFields([{ name: "cv", kind: "file", value: "/a/cv.pdf" }], [{ name: "cv", value: "cv.pdf" }]),
    ).toEqual([]);
  });
});

describe("blockers and needs", () => {
  test("two blocked fields of one application form one group", async () => {
    const dir = { path: workDir };
    await recordBlocker(dir, "acme-1", "field", "salary");
    await recordBlocker(dir, "acme-1", "field", "visa");
    await recordBlocker(dir, "acme-1", "application", "captcha");
    await recordBlocker(dir, "beta-2", "field", "phone");
    const groups = await listNeeds(dir);
    expect(groups).toHaveLength(3);
    const fieldGroup = groups.find((group) => group.key === "acme-1" && group.scope === "field");
    expect(fieldGroup?.items.map((item) => item.detail)).toEqual(["salary", "visa"]);
  });
});

describe("cli", () => {
  test("answer abstains, records a field blocker, then needs lists it", () => {
    const abstained = cli(["apply", "answer", "What is your salary expectation?", "--key", "acme-1"]);
    expect(abstained.code).toBe(0);
    expect(abstained.envelope["data"]).toMatchObject({ status: "abstain" });
    const needs = cli(["needs"]);
    expect(JSON.stringify(needs.envelope["data"])).toContain("salary expectation");
  });

  test("answer saved by the human is returned next time", () => {
    const question = "Salary expectation?";
    expect(cli(["apply", "answer", question, "--save", "90k", "--provenance", "human"]).code).toBe(0);
    const found = cli(["apply", "answer", question, "--key", "acme-1"]);
    expect(found.envelope["data"]).toMatchObject({ status: "answer", text: "90k", provenance: "human" });
  });

  test("block records and needs groups two fields", () => {
    cli(["apply", "block", "acme-1", "--scope", "field", "--detail", "salary"]);
    cli(["apply", "block", "acme-1", "--scope", "field", "--detail", "visa"]);
    const needs = cli(["needs"]);
    const data = needs.envelope["data"] as { groups: { items: unknown[] }[] };
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]?.items).toHaveLength(2);
  });

  test("verify exits 1 when the uploaded file name differs", () => {
    const intended = path.join(workDir, "intended.json");
    const dump = path.join(workDir, "dump.json");
    writeFileSync(intended, JSON.stringify([{ name: "cv", kind: "file", value: "cv-acme.pdf" }]));
    writeFileSync(dump, JSON.stringify([{ name: "cv", value: "other.pdf" }]));
    const mismatch = cli(["apply", "verify", "--intended", intended, "--dump", dump]);
    expect(mismatch.code).toBe(1);
    expect(JSON.stringify(mismatch.envelope)).toContain("file-name-mismatch");
    writeFileSync(dump, JSON.stringify([{ name: "cv", value: "cv-acme.pdf" }]));
    expect(cli(["apply", "verify", "--intended", intended, "--dump", dump]).code).toBe(0);
  });
});
