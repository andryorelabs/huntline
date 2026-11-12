import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isObject } from "../core/narrow.ts";
import { ANSWER_KEYS, resolveAnswerKey } from "./answer-keys.ts";
import { lookupAnswer, saveAnswer } from "./answers.ts";
import { listNeeds, recordBlocker, unansweredDetail } from "./blockers.ts";
import { verifyFields } from "./verify.ts";

const cliPath = path.join(import.meta.dir, "../cli.ts");
let workDir = "";

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "jobship-apply-"));
  writeFileSync(path.join(workDir, "jobship.json"), '{"version":1}\n');
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function cli(args: string[]): { code: number; envelope: Record<string, unknown> } {
  const result = Bun.spawnSync([process.execPath, cliPath, ...args, "--data", workDir], {
    cwd: workDir,
    env: { PATH: process.env["PATH"] ?? "", HOME: workDir },
  });
  const lines = result.stdout
    .toString()
    .split("\n")
    .filter((line) => line !== "");
  expect(lines).toHaveLength(1);
  const parsed: unknown = JSON.parse(lines[0] ?? "");
  if (!isObject(parsed)) throw new Error("envelope is not an object");
  return { code: result.exitCode, envelope: parsed };
}

describe("answer bank", () => {
  test("abstains with no answer and returns saved answer with provenance", async () => {
    const dir = { path: workDir };
    expect(lookupAnswer(dir, "Expected salary?", "acme").status).toBe("abstain");
    expect((await saveAnswer(dir, "Expected salary?", "acme", "90k", "human 2026-11-09")).ok).toBe(
      true,
    );
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

  test("scoped save is found only by that scope", async () => {
    const dir = { path: workDir };
    await saveAnswer(dir, "Why us?", "company:acme", "great", "human");
    expect(lookupAnswer(dir, "Why us?", "company:acme").status).toBe("answer");
    expect(lookupAnswer(dir, "Why us?", "company:globex").status).toBe("abstain");
  });

  test("scoped save closes only blockers of that scope, global closes all", async () => {
    const dir = { path: workDir };
    await recordBlocker(dir, "acme-1", "field", unansweredDetail("Why us?", "company:acme"));
    await recordBlocker(dir, "globex-1", "field", unansweredDetail("Why us?", "company:globex"));
    await saveAnswer(dir, "Why us?", "company:acme", "great", "human");
    const remaining = async () =>
      (await listNeeds(dir)).flatMap((group) => group.items.map(() => group.key));
    expect(await remaining()).toEqual(["globex-1"]);
    await saveAnswer(dir, "Why us?", "global", "fine", "human");
    expect(await remaining()).toEqual([]);
  });

  test("a scope containing spaces still closes its blockers and dedupes", async () => {
    const dir = { path: workDir };
    const detail = unansweredDetail("Why us?", "company:Acme Corp");
    const first = await recordBlocker(dir, "acme-1", "field", detail);
    expect(await recordBlocker(dir, "acme-1", "field", detail)).toEqual(first);
    expect(await listNeeds(dir)).toHaveLength(1);
    await saveAnswer(dir, "Why us?", "company:Acme Corp", "great", "human");
    expect(await listNeeds(dir)).toEqual([]);
  });

  test("blocking the same question twice for one key is a no-op", async () => {
    const dir = { path: workDir };
    const first = await recordBlocker(dir, "acme-1", "field", unansweredDetail("Visa?", "global"));
    const second = await recordBlocker(dir, "acme-1", "field", unansweredDetail("visa", "global"));
    expect(second).toEqual(first);
    await recordBlocker(dir, "acme-2", "field", unansweredDetail("Visa?", "global"));
    expect(await listNeeds(dir)).toHaveLength(2);
    expect((await listNeeds(dir))[0]?.items).toHaveLength(1);
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
    const data = listed.envelope["data"];
    const answers = isObject(data) ? data["answers"] : undefined;
    expect(answers).toHaveLength(2);
    expect(answers).toContainEqual(
      expect.objectContaining({ scope: "acme", provenance: "profile" }),
    );
    expect(answers).toContainEqual(
      expect.objectContaining({ scope: "global", provenance: "human" }),
    );
  });

  test("saving closes matching open field blockers only", async () => {
    const dir = { path: workDir };
    await recordBlocker(dir, "acme-1", "field", "no answer for: How soon can you start?");
    await recordBlocker(dir, "acme-1", "field", "no answer for: Visa?");
    await recordBlocker(dir, "acme-1", "section", "no answer for: How soon can you start?");
    const saved = await saveAnswer(dir, "how soon can you start", "global", "now", "human");
    expect(saved.ok).toBe(true);
    const groups = await listNeeds(dir);
    expect(
      groups
        .flatMap((group) => group.items.map((item) => `${group.scope}:${item.detail}`))
        .toSorted(),
    ).toEqual(["field:no answer for: Visa?", "section:no answer for: How soon can you start?"]);
  });
});

describe("lever reference", () => {
  test("orders text fields, CV upload last, then snapshot read-back", () => {
    const text = readFileSync(
      path.join(import.meta.dir, "../../skills/apply/references/lever.md"),
      "utf8",
    );
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
      verifyFields(
        [{ name: "cv", kind: "file", value: "/a/cv.pdf" }],
        [{ name: "cv", value: "cv.pdf" }],
      ),
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
    const abstained = cli([
      "apply",
      "answer",
      "What is your salary expectation?",
      "--key",
      "acme-1",
    ]);
    expect(abstained.code).toBe(0);
    expect(abstained.envelope["data"]).toMatchObject({ status: "abstain" });
    const needs = cli(["needs"]);
    expect(JSON.stringify(needs.envelope["data"])).toContain("salary expectation");
  });

  test("answer saved by the human is returned next time", () => {
    const question = "Salary expectation?";
    expect(cli(["apply", "answer", question, "--save", "90k", "--provenance", "human"]).code).toBe(
      0,
    );
    const found = cli(["apply", "answer", question, "--key", "acme-1"]);
    expect(found.envelope["data"]).toMatchObject({
      status: "answer",
      text: "90k",
      provenance: "human",
    });
  });

  test("block records and needs groups two fields", () => {
    cli(["apply", "block", "acme-1", "--scope", "field", "--detail", "salary"]);
    cli(["apply", "block", "acme-1", "--scope", "field", "--detail", "visa"]);
    const needs = cli(["needs"]);
    const data = needs.envelope["data"];
    const groups: unknown = isObject(data) ? data["groups"] : undefined;
    expect(groups).toHaveLength(1);
    const firstGroup: unknown = Array.isArray(groups) ? groups[0] : undefined;
    expect(isObject(firstGroup) ? firstGroup["items"] : undefined).toHaveLength(2);
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

describe("answer keys", () => {
  test("resolves synonym phrasings to one key and rejects unknown questions", () => {
    expect(resolveAnswerKey("What are your salary expectations for this role?")).toBe(
      "salary-expectation",
    );
    expect(resolveAnswerKey("Desired salary")).toBe("salary-expectation");
    expect(resolveAnswerKey("Are you authorized to work in the United States?")).toBe(
      "work-authorization-us",
    );
    expect(resolveAnswerKey("Why do you want this job?")).toBeNull();
  });

  test("answers every sponsorship phrasing from one row and does not over-match", () => {
    const dir = { path: workDir };
    writeFileSync(
      path.join(workDir, "answers.json"),
      JSON.stringify([
        { answerKey: "sponsorship", scope: "global", text: "No", provenance: "human" },
        { answerKey: "languages", scope: "global", text: "English C1", provenance: "human" },
      ]),
    );
    for (const question of [
      "Will you now or in the future require visa sponsorship?",
      "Do you need sponsorship to work here?",
    ]) {
      expect(lookupAnswer(dir, question, "global")).toMatchObject({ status: "answer", text: "No" });
    }
    expect(resolveAnswerKey("Do you have a non-compete?")).toBe("non-compete");
    expect(resolveAnswerKey("What programming languages are you proficient in?")).toBeNull();
    expect(resolveAnswerKey("How many years of experience do you have with React?")).toBeNull();
    expect(lookupAnswer(dir, "What languages do you speak?", "global")).toMatchObject({
      status: "answer",
      text: "English C1",
    });
  });

  test("catalog has unique keys and tier-D identity keys", () => {
    const keys = ANSWER_KEYS.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    const tierD = ANSWER_KEYS.filter((entry) => entry.tier === "D").map((entry) => entry.key);
    expect(tierD.toSorted()).toEqual(["disability", "gender", "race-ethnicity", "veteran"]);
  });

  test("a synonym phrasing finds an answer saved under the key", async () => {
    const dir = { path: workDir };
    await saveAnswer(dir, "Expected salary?", "global", "90k", "human");
    expect(lookupAnswer(dir, "What are your salary expectations?", "acme")).toEqual({
      status: "answer",
      text: "90k",
      provenance: "human",
    });
    const rows: unknown = JSON.parse(readFileSync(path.join(workDir, "answers.json"), "utf8"));
    expect(rows).toEqual([
      { answerKey: "salary-expectation", scope: "global", text: "90k", provenance: "human" },
    ]);
  });

  test("unmatched questions are stored under the normalized question", async () => {
    const dir = { path: workDir };
    await saveAnswer(dir, "Why us?", "global", "great", "human");
    const rows: unknown = JSON.parse(readFileSync(path.join(workDir, "answers.json"), "utf8"));
    expect(rows).toEqual([
      { answerKey: "why us", scope: "global", text: "great", provenance: "human" },
    ]);
  });

  test("tier-D keys always abstain and cannot be saved", async () => {
    const dir = { path: workDir };
    writeFileSync(
      path.join(workDir, "answers.json"),
      JSON.stringify([{ answerKey: "gender", scope: "global", text: "x", provenance: "human" }]),
    );
    expect(lookupAnswer(dir, "What is your gender?", "global").status).toBe("abstain");
    const saved = await saveAnswer(dir, "Gender", "global", "x", "human");
    expect(saved.ok).toBe(false);
  });

  test("saving under a key closes blockers for any phrasing of it", async () => {
    const dir = { path: workDir };
    await recordBlocker(dir, "acme-1", "field", unansweredDetail("Desired salary?", "global"));
    await saveAnswer(dir, "Salary expectations", "global", "90k", "human");
    expect(await listNeeds(dir)).toEqual([]);
  });

  test("legacy question rows are still read", () => {
    const dir = { path: workDir };
    writeFileSync(
      path.join(workDir, "answers.json"),
      JSON.stringify([
        { question: "expected salary", scope: "global", text: "80k", provenance: "human" },
      ]),
    );
    expect(lookupAnswer(dir, "salary expectations", "global").status).toBe("answer");
  });
});
