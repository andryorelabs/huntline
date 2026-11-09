import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { exitCodeFor } from "../core/envelope.ts";
import { EMAIL_CLASSES } from "../inbox/types.ts";
import { run } from "./command.ts";
import { scoreClassifications, type LabelledEmail } from "./score.ts";

const FIXTURES = path.resolve(import.meta.dir, "..", "..", "fixtures", "inbox");

function loadFixtures(): LabelledEmail[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.endsWith(".json"))
    .toSorted()
    .flatMap((name) => JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8")) as LabelledEmail[]);
}

let root = "";

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "inbox-eval-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function context(): CommandContext {
  return { dataDir: null, env: {}, cwd: root };
}

describe("fixtures", () => {
  const fixtures = loadFixtures();

  test("has at least 40 emails with unique ids", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(40);
    expect(new Set(fixtures.map((email) => email.messageId)).size).toBe(fixtures.length);
  });

  test("covers both languages and every class in each", () => {
    for (const language of ["en", "es"] as const) {
      for (const label of EMAIL_CLASSES) {
        expect(fixtures.some((email) => email.language === language && email.label === label)).toBe(true);
      }
    }
  });
});

describe("scoreClassifications", () => {
  const fixtures = loadFixtures();

  test("perfect predictions give accuracy 1 and full precision and recall", () => {
    const report = scoreClassifications(
      fixtures,
      fixtures.map((email) => ({ messageId: email.messageId, classification: email.label })),
    );
    expect(report.accuracy).toBe(1);
    expect(report.correct).toBe(fixtures.length);
    for (const name of EMAIL_CLASSES) {
      expect(report.perClass[name].precision).toBe(1);
      expect(report.perClass[name].recall).toBe(1);
    }
  });

  test("a wrong prediction lowers recall of the true class and precision of the predicted one", () => {
    const first = fixtures.find((email) => email.label === "rejection");
    if (first === undefined) throw new Error("fixture missing");
    const predictions = fixtures.map((email) => ({
      messageId: email.messageId,
      classification: email.messageId === first.messageId ? ("other" as const) : email.label,
    }));
    const report = scoreClassifications(fixtures, predictions);
    expect(report.correct).toBe(fixtures.length - 1);
    expect(report.perClass.rejection.recall).toBeLessThan(1);
    expect(report.perClass.rejection.precision).toBe(1);
    expect(report.perClass.other.precision).toBeLessThan(1);
    expect(report.perClass.other.recall).toBe(1);
  });

  test("missing predictions count as wrong and extras are listed as unknown", () => {
    const report = scoreClassifications(fixtures, [{ messageId: "nope", classification: "other" }]);
    expect(report.accuracy).toBe(0);
    expect(report.missing.length).toBe(fixtures.length);
    expect(report.unknown).toEqual(["nope"]);
  });

  test("precision is null when a class is never predicted", () => {
    const report = scoreClassifications(fixtures, []);
    expect(report.perClass.offer.precision).toBeNull();
    expect(report.perClass.offer.recall).toBe(0);
  });
});

describe("inbox eval command", () => {
  test("matching classifications file yields accuracy 1.0 and exit 0", async () => {
    const rows = loadFixtures().map((email) => ({ messageId: email.messageId, classification: email.label }));
    writeFileSync(path.join(root, "c.json"), JSON.stringify(rows));
    const envelope = await run(["c.json"], context());
    expect(exitCodeFor(envelope)).toBe(0);
    if (!envelope.ok) throw new Error("expected success");
    expect(envelope.data).toMatchObject({ accuracy: 1 });
  });

  test("missing file argument is a usage error", async () => {
    const envelope = await run([], context());
    expect(exitCodeFor(envelope)).toBe(2);
  });

  test("malformed classifications are a usage error", async () => {
    writeFileSync(path.join(root, "c.json"), JSON.stringify([{ messageId: "x", classification: "bogus" }]));
    const envelope = await run(["c.json"], context());
    expect(exitCodeFor(envelope)).toBe(2);
  });

  test("unreadable file is a usage error", async () => {
    const envelope = await run(["absent.json"], context());
    expect(exitCodeFor(envelope)).toBe(2);
  });
});
