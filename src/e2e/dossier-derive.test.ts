import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isObject } from "../core/narrow.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
const CLI_ENTRY = path.join(REPO_ROOT, "src/cli.ts");
const FIXTURES = path.join(REPO_ROOT, "fixtures/dossier");
const DERIVED_FILES = [
  "facts.yaml",
  "bullets.yaml",
  "profile.yaml",
  "never-claim.yaml",
  "answers.json",
] as const;

let dataDir = "";

type CliResult = { readonly code: number; readonly envelope: Record<string, unknown> };

function runCli(args: string[]): CliResult {
  const result = Bun.spawnSync([process.execPath, CLI_ENTRY, ...args, "--data", dataDir], {
    cwd: dataDir,
    env: { PATH: process.env["PATH"] ?? "", HOME: dataDir },
    stdout: "pipe",
    stderr: "pipe",
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

function setUpDataDir(): void {
  cpSync(path.join(FIXTURES, "complete", "dossier"), path.join(dataDir, "dossier"), {
    recursive: true,
  });
  for (const file of ["facts.yaml", "bullets.yaml", "profile.yaml", "never-claim.yaml"]) {
    cpSync(path.join(REPO_ROOT, "templates", file), path.join(dataDir, file));
  }
  writeFileSync(path.join(dataDir, "answers.json"), "[]\n");
}

function loadProposal(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path.join(FIXTURES, "proposal.json"), "utf8"));
  if (!isObject(parsed)) throw new Error("fixture proposal is not an object");
  return parsed;
}

function writeProposal(proposal: Record<string, unknown>): string {
  const file = path.join(dataDir, "proposal.json");
  writeFileSync(file, JSON.stringify(proposal));
  return file;
}

function derive(proposal: Record<string, unknown> = loadProposal()): CliResult {
  return runCli(["dossier", "derive", "--file", writeProposal(proposal)]);
}

function dataOf(result: CliResult): Record<string, unknown> {
  const data = result.envelope["data"];
  if (!isObject(data)) throw new Error("envelope has no data");
  return data;
}

function batchOf(result: CliResult): string {
  const batch = dataOf(result)["batchPath"];
  if (typeof batch !== "string") throw new Error("no batchPath");
  return batch;
}

function errorCode(result: CliResult): unknown {
  const error = result.envelope["error"];
  return isObject(error) ? error["code"] : undefined;
}

function snapshot(): Record<string, string> {
  return Object.fromEntries(
    DERIVED_FILES.map((file) => [file, readFileSync(path.join(dataDir, file), "utf8")]),
  );
}

beforeEach(() => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "jobship-derive-e2e-"));
  setUpDataDir();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("dossier derive and apply", () => {
  test("derive then apply writes the derived files and a re-derive is empty", () => {
    const first = derive();
    expect(first.code).toBe(0);
    expect(dataOf(first)["count"]).toBe(6);
    expect(existsSync(batchOf(first))).toBe(true);
    expect(batchOf(first)).toContain(path.join("dossier", "batches", "batch-"));
    const applied = runCli(["dossier", "apply", batchOf(first)]);
    expect(applied.code).toBe(0);
    expect(dataOf(applied)["applied"]).toBe(6);
    const afterFirst = snapshot();
    expect(afterFirst["facts.yaml"]).toContain("checkout-latency");
    expect(afterFirst["answers.json"]).toContain("sponsorship");
    expect(runCli(["dossier", "check"]).code).toBe(0);
    const second = derive();
    expect(second.code).toBe(0);
    expect(dataOf(second)["items"]).toEqual([]);
    const reapplied = runCli(["dossier", "apply", batchOf(first)]);
    expect(dataOf(reapplied)["applied"]).toBe(0);
    expect(snapshot()).toEqual(afterFirst);
  });

  test("citations are 1-based including front matter", () => {
    const career = readFileSync(path.join(dataDir, "dossier", "career.md"), "utf8").split("\n");
    expect(career[9]).toStartWith("- Cut p95");
    const proposal = loadProposal();
    const facts = proposal["facts"];
    if (!Array.isArray(facts) || !isObject(facts[0])) throw new Error("fixture shape");
    facts[0]["cites"] = ["dossier/career.md:999"];
    const result = derive(proposal);
    expect(result.code).toBe(1);
    expect(errorCode(result)).toBe("proposal-invalid");
    facts[0]["cites"] = ["dossier/career.md:5"];
    expect(errorCode(derive(proposal))).toBe("proposal-invalid");
  });

  test("an unknown source is refused", () => {
    const proposal = loadProposal();
    const facts = proposal["facts"];
    if (!Array.isArray(facts) || !isObject(facts[0])) throw new Error("fixture shape");
    facts[0]["source"] = "twitter";
    expect(errorCode(derive(proposal))).toBe("proposal-invalid");
  });

  test("a fact or bullet holding an identity value is refused", () => {
    const proposal = loadProposal();
    const facts = proposal["facts"];
    if (!Array.isArray(facts) || !isObject(facts[1])) throw new Error("fixture shape");
    facts[1]["text"] = "Lived at 123 example st while building the pipeline";
    const result = derive(proposal);
    expect(result.code).toBe(1);
    expect(errorCode(result)).toBe("identity-leak");
    facts[1]["text"] = "Built the CI pipeline for 12 services";
    const bullets = proposal["bullets"];
    if (!Array.isArray(bullets) || !isObject(bullets[0])) throw new Error("fixture shape");
    bullets[0]["text"] = "Born 1990-01-01 and cut latency";
    expect(errorCode(derive(proposal))).toBe("identity-leak");
  });

  test("a tier D Answer key and an unknown Answer key are refused", () => {
    const proposal = loadProposal();
    const answers = proposal["answers"];
    if (!Array.isArray(answers) || !isObject(answers[0])) throw new Error("fixture shape");
    answers[0]["answerKey"] = "gender";
    expect(errorCode(derive(proposal))).toBe("proposal-invalid");
    answers[0]["answerKey"] = "not-a-key";
    expect(errorCode(derive(proposal))).toBe("proposal-invalid");
  });

  test("an edited batch fails batch-changed and changes nothing", () => {
    const batch = batchOf(derive());
    const before = snapshot();
    writeFileSync(batch, readFileSync(batch, "utf8").replace("Built the CI", "Built a CI"));
    const result = runCli(["dossier", "apply", batch]);
    expect(result.code).toBe(1);
    expect(errorCode(result)).toBe("batch-changed");
    expect(snapshot()).toEqual(before);
  });

  test("a missing batch fails batch-not-found", () => {
    const result = runCli(["dossier", "apply", path.join(dataDir, "nope.json")]);
    expect(result.code).toBe(1);
    expect(errorCode(result)).toBe("batch-not-found");
  });

  test("re-derive after a manual edit proposes only the diff and keeps unmentioned facts", () => {
    runCli(["dossier", "apply", batchOf(derive())]);
    const factsPath = path.join(dataDir, "facts.yaml");
    const edited = readFileSync(factsPath, "utf8").replace(
      "Built the CI pipeline for 12 services with GitHub Actions",
      "Built the CI pipeline for 12 services",
    );
    writeFileSync(
      factsPath,
      `${edited}  - id: manual-fact\n    text: Hand-written fact\n    tags: []\n`,
    );
    const rederived = derive();
    expect(dataOf(rederived)["items"]).toEqual([
      { file: "facts.yaml", op: "update", id: "ci-pipeline" },
    ]);
    runCli(["dossier", "apply", batchOf(rederived)]);
    const facts = readFileSync(factsPath, "utf8");
    expect(facts).toContain("manual-fact");
    expect(facts).toContain("with GitHub Actions");
  });

  test("facts are removed only when listed as removals", () => {
    runCli(["dossier", "apply", batchOf(derive())]);
    const proposal = loadProposal();
    proposal["facts"] = [];
    proposal["bullets"] = [];
    proposal["profile"] = {};
    proposal["neverClaim"] = [];
    proposal["answers"] = [];
    expect(dataOf(derive(proposal))["items"]).toEqual([]);
    proposal["removals"] = { facts: ["ci-pipeline"], bullets: [] };
    const result = derive(proposal);
    expect(dataOf(result)["items"]).toEqual([
      { file: "facts.yaml", op: "remove", id: "ci-pipeline" },
    ]);
    runCli(["dossier", "apply", batchOf(result)]);
    const facts = readFileSync(path.join(dataDir, "facts.yaml"), "utf8");
    expect(facts).not.toContain("ci-pipeline");
    expect(facts).toContain("checkout-latency");
  });

  test("cv lint fails identity-leak for a street address in the CV text", () => {
    runCli(["dossier", "apply", batchOf(derive())]);
    const cvText = path.join(dataDir, "cv.txt");
    writeFileSync(cvText, "Jane Example\n123 Example St\n");
    const result = runCli(["cv", "lint", "--file", cvText]);
    expect(result.code).toBe(1);
    expect(JSON.stringify(result.envelope)).toContain('identity field \\"streetAddress\\"');
  });
});
