import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isObject } from "../core/narrow.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
const CLI_ENTRY = path.join(REPO_ROOT, "src/cli.ts");
const EXAMPLE_CV = path.join(REPO_ROOT, "examples/cv");

const TYPST_STUB = `#!/bin/sh
while [ $# -gt 1 ]; do
  case "$1" in
    --root) root="$2"; shift 2 ;;
    --input) data="\${2#data=}"; shift 2 ;;
    *) shift ;;
  esac
done
cat "$root/$data" > "$1"
`;

const PDFTOTEXT_STUB = `#!/bin/sh
cat "$2"
`;

const FLAT_FACTS = `facts:
  - id: f-api-latency
    text: Cut p95 latency of the Acme Corp checkout API from 900 ms to 300 ms.
    tags: [typescript, performance, api]
  - id: f-ci-pipeline
    text: Built the CI pipeline for 12 services at Acme Corp using GitHub Actions.
    tags: [ci, github actions, devops]
  - id: f-mentoring
    text: Mentored 3 junior engineers at Acme Corp.
    tags: [mentoring, leadership]
`;

const FLAT_BULLETS = `bullets:
  - id: b-latency
    text: Reduced checkout API p95 latency from 900 ms to 300 ms.
    tags: [backend, performance]
    facts: [f-api-latency]
  - id: b-ci
    text: Built the CI pipeline for 12 services with GitHub Actions.
    tags: [devops]
    facts: [f-ci-pipeline]
  - id: b-mentoring
    text: Mentored 3 junior engineers.
    tags: [leadership]
    facts: [f-mentoring]
`;

const LEAD_KEY = "acme|backend engineer|latam";
const DUPLICATE_KEY = "acme|backend engineer|";
const DISMISSED_KEY = "globex|designer|us only";
const SECOND_LEAD_KEY = "initech|platform engineer|";

type CliResult = {
  readonly code: number;
  readonly stdout: string;
  readonly envelope: Record<string, unknown>;
};

let workDir = "";
let dataDir = "";
let binDir = "";

const FETCH_STUB = path.join(REPO_ROOT, "src/e2e/stub-fetch.preload.ts");

function runCli(
  args: string[],
  extraEnv: Record<string, string> = {},
  runtimeArgs: string[] = [],
): CliResult {
  const result = Bun.spawnSync(
    [process.execPath, ...runtimeArgs, CLI_ENTRY, ...args, "--data", dataDir],
    {
      cwd: workDir,
      env: { PATH: `${binDir}:${process.env["PATH"] ?? ""}`, HOME: workDir, ...extraEnv },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const stdout = result.stdout.toString();
  const lines = stdout.split("\n").filter((line) => line !== "");
  expect(lines).toHaveLength(1);
  const parsed: unknown = JSON.parse(lines[0] ?? "");
  if (typeof parsed !== "object" || parsed === null) throw new Error("envelope is not an object");
  return { code: result.exitCode, stdout, envelope: { ...parsed } };
}

function dataOf(result: CliResult): Record<string, unknown> {
  expect(result.envelope["ok"]).toBe(true);
  const data = result.envelope["data"];
  if (typeof data !== "object" || data === null) throw new Error("envelope has no data");
  return { ...data };
}

function errorCodeOf(result: CliResult): string {
  expect(result.envelope["ok"]).toBe(false);
  const error = result.envelope["error"];
  if (!isObject(error)) throw new Error("envelope has no error");
  return String(error["code"]);
}

function ok(args: string[]): Record<string, unknown> {
  const result = runCli(args);
  expect(result.code).toBe(0);
  return dataOf(result);
}

function writeDataDir(): void {
  writeFileSync(path.join(dataDir, "huntline.json"), '{"version":1}\n');
  writeFileSync(
    path.join(dataDir, "profile.yaml"),
    JSON.stringify({
      regions: ["LATAM"],
      contractTypes: ["full-time"],
      remote: "remote-only",
      stack: { include: ["typescript"], exclude: [] },
      salaryFloor: null,
      excludedCompanies: [],
      outreachDailyCap: 5,
      sources: [],
      tracker: { kind: "local", directory: "tracker" },
    }),
  );
  copyFileSync(path.join(EXAMPLE_CV, "never-claim.yaml"), path.join(dataDir, "never-claim.yaml"));
  writeFileSync(path.join(dataDir, "facts.yaml"), FLAT_FACTS);
  writeFileSync(path.join(dataDir, "bullets.yaml"), FLAT_BULLETS);
  mkdirSync(path.join(dataDir, "cv"));
  copyFileSync(path.join(EXAMPLE_CV, "template.typ"), path.join(dataDir, "cv", "template.typ"));
}

function writeToolStubs(): void {
  writeFileSync(path.join(binDir, "typst"), TYPST_STUB, { mode: 0o755 });
  writeFileSync(path.join(binDir, "pdftotext"), PDFTOTEXT_STUB, { mode: 0o755 });
}

const FIXTURE_POSTINGS = [
  {
    id: "gh-1",
    url: "https://boards.example/acme/1",
    company: "Acme Corp",
    title: "Backend Engineer",
    location: "Remote LATAM",
    remote: true,
    contract: "full-time",
    stack: ["typescript"],
    description: "Build APIs with TypeScript. Kubernetes is a plus.",
  },
  {
    id: "gh-2",
    url: "https://boards.example/globex/2",
    company: "Globex",
    title: "Designer",
    location: "US only",
    remote: true,
    contract: "full-time",
  },
  {
    id: "him-3",
    url: "https://himalayas.example/acme-backend",
    company: "Acme Corp",
    title: "Backend Engineer",
    remote: true,
    stack: ["typescript"],
  },
  {
    id: "gh-4",
    url: "https://boards.example/initech/4",
    company: "Initech",
    title: "Platform Engineer",
    remote: true,
    contract: "full-time",
    stack: ["typescript"],
  },
];

function writeJson(name: string, value: unknown): string {
  const file = path.join(workDir, name);
  writeFileSync(file, JSON.stringify(value));
  return file;
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "jobship-e2e-"));
  dataDir = path.join(workDir, "data");
  binDir = path.join(workDir, "bin");
  mkdirSync(dataDir);
  mkdirSync(binDir);
  writeDataDir();
  writeToolStubs();
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("end-to-end sweep over a fixture Source", () => {
  test("a configured Source produces a Lead and a second sweep finds nothing new", () => {
    const profilePath = path.join(dataDir, "profile.yaml");
    const profile: unknown = JSON.parse(readFileSync(profilePath, "utf8"));
    if (!isObject(profile)) throw new Error("profile is not an object");
    writeFileSync(
      profilePath,
      JSON.stringify({ ...profile, sources: ["remoteok"], remote: "any" }),
    );
    const first = runCli(["sweep"], {}, ["--preload", FETCH_STUB]);
    expect(first.code).toBe(0);
    const firstData = dataOf(first);
    expect(firstData["failed"]).toEqual([]);
    expect(firstData["leads"]).toHaveLength(1);
    const second = dataOf(runCli(["sweep"], {}, ["--preload", FETCH_STUB]));
    expect(second["leads"]).toEqual([]);
    expect(second["failed"]).toEqual([]);
  });
});

describe("end-to-end flow with the local tracker", () => {
  test("doctor, sweep, ingest, score, cv, apply, inbox and status", () => {
    const doctor = ok(["doctor"]);
    expect(doctor["tracker"]).toBe("local");
    expect(doctor["markers"]).toBe(0);

    const sweep = ok(["sweep"]);
    expect(sweep["failed"]).toEqual([]);
    expect(sweep["leads"]).toEqual([]);

    const ingest = ok([
      "ingest",
      "--source",
      "fixture",
      "--json",
      JSON.stringify(FIXTURE_POSTINGS),
    ]);
    expect(ingest["leads"]).toEqual([LEAD_KEY, SECOND_LEAD_KEY]);
    expect(ingest["dismissed"]).toBe(1);

    const ledger = ok(["ledger", "list"]);
    const entries: unknown = ledger["entries"];
    if (!Array.isArray(entries)) throw new Error("ledger entries is not a list");
    const outcomes = new Map(
      entries.map((entry: unknown) => {
        if (!isObject(entry)) throw new Error("ledger entry is not an object");
        return [String(entry["key"]), entry] as const;
      }),
    );
    expect(outcomes.get(DUPLICATE_KEY)?.["outcome"]).toBe("duplicate");
    expect(outcomes.get(DISMISSED_KEY)?.["outcome"]).toBe("dismissed");
    expect(outcomes.get(DISMISSED_KEY)?.["reason"]).toBe("region");

    const rerun = ok(["ingest", "--source", "fixture", "--json", JSON.stringify(FIXTURE_POSTINGS)]);
    expect(rerun["new"]).toBe(0);
    expect(rerun["leads"]).toEqual([]);

    const scored = ok([
      "score",
      LEAD_KEY,
      "--score",
      "82",
      "--reason",
      "stack match",
      "--liveness",
      "live",
    ]);
    expect(scored["score"]).toBe(82);
    expect(scored["liveness"]).toBe("live");

    const coverage = ok(["cv", "coverage", LEAD_KEY, "--requirement", "TypeScript,Kubernetes"]);
    expect(coverage["missing"]).toEqual(["Kubernetes"]);

    const built = ok(["cv", "build", "--variant", "acme", "--tag", "backend"]);
    expect(String(built["pdf"])).toEndWith("cv/out/acme.pdf");
    const cvText = readFileSync(String(built["text"]), "utf8");
    expect(cvText).toContain("Reduced checkout API p95 latency");
    expect(cvText).not.toContain("Kubernetes");
    expect(ok(["cv", "lint", "--variant", "acme"])["findings"]).toEqual([]);

    const intended = writeJson("intended.json", [
      { name: "email", value: "ada@example.com" },
      { name: "resume", kind: "file", value: "acme.pdf" },
    ]);
    const matching = writeJson("dump-ok.json", [
      { name: "email", value: "ada@example.com" },
      { name: "resume", value: "acme.pdf" },
    ]);
    const wrongFile = writeJson("dump-bad.json", [
      { name: "email", value: "ada@example.com" },
      { name: "resume", value: "other.pdf" },
    ]);
    expect(ok(["apply", "verify", "--intended", intended, "--dump", matching])["verified"]).toBe(2);
    const mismatch = runCli(["apply", "verify", "--intended", intended, "--dump", wrongFile]);
    expect(mismatch.code).toBe(1);
    expect(errorCodeOf(mismatch)).toBe("verify-mismatch");

    const abstained = ok([
      "apply",
      "answer",
      "What is your salary expectation?",
      "--key",
      LEAD_KEY,
    ]);
    expect(abstained["status"]).toBe("abstain");
    const needs = ok(["needs"]);
    expect(needs["groups"]).toHaveLength(1);

    expect(ok(["status", LEAD_KEY, "--set", "applied"])).toEqual({
      key: LEAD_KEY,
      from: "lead",
      to: "applied",
    });
    expect(ok(["status", LEAD_KEY])["state"]).toBe("applied");
    expect(errorCodeOf(runCli(["status", LEAD_KEY, "--set", "bogus"]))).toBe("usage");

    const emails = writeJson("emails.json", [
      {
        messageId: "msg-1",
        threadId: "thread-1",
        from: "careers@acme.example",
        subject: "Update on your application to Acme Corp",
        classification: "rejection",
      },
    ]);
    const proposed = ok(["inbox", "propose", "--emails", emails]);
    expect(proposed["confirmed"]).toBe(1);
    const batchPath = String(proposed["batchPath"]);

    const applied = ok(["inbox", "apply", batchPath]);
    expect(applied["applied"]).toBe(1);
    expect(ok(["inbox", "apply", batchPath])["applied"]).toBe(0);
    expect(ok(["status", LEAD_KEY])["state"]).toBe("rejected");

    const eventCount = ok(["events", "list"])["count"];
    expect(eventCount).toBeGreaterThan(5);
  });

  test("a batch edited after proposal is refused", () => {
    ok(["ingest", "--source", "fixture", "--json", JSON.stringify(FIXTURE_POSTINGS)]);
    ok([
      "events",
      "append",
      "--json",
      JSON.stringify({ kind: "status.changed", key: LEAD_KEY, to: "applied" }),
    ]);
    const emails = writeJson("emails.json", [
      {
        messageId: "msg-2",
        threadId: "thread-2",
        from: "careers@acme.example",
        subject: "Update on your application",
        classification: "rejection",
      },
    ]);
    const batchPath = String(ok(["inbox", "propose", "--emails", emails])["batchPath"]);
    writeFileSync(batchPath, `${readFileSync(batchPath, "utf8")}\n `);
    const refused = runCli(["inbox", "apply", batchPath]);
    expect(refused.code).toBe(1);
    expect(errorCodeOf(refused)).toBe("batch-changed");
    expect(ok(["status", LEAD_KEY])["state"]).toBe("applied");
  });

  test("a Never-claim term fails cv lint with exit 1", () => {
    ok(["cv", "build", "--variant", "acme", "--tag", "backend"]);
    const textFile = path.join(workDir, "tainted.txt");
    writeFileSync(textFile, "Led the Kubernetes migration for the platform.\n");
    const result = runCli(["cv", "lint", "--file", textFile]);
    expect(result.code).toBe(1);
    expect(errorCodeOf(result)).toBe("lint-failed");
  });

  test("a malformed Profile exits 2 and markers exit 1", () => {
    writeFileSync(path.join(dataDir, "facts.yaml"), "# TODO(huntline): fill\nfacts: []\n");
    const markers = runCli(["doctor"]);
    expect(markers.code).toBe(1);
    expect(errorCodeOf(markers)).toBe("todo-markers");
    writeFileSync(path.join(dataDir, "profile.yaml"), "regions: [unterminated\n");
    const malformed = runCli(["doctor"]);
    expect(malformed.code).toBe(2);
    expect(errorCodeOf(malformed)).toBe("profile-malformed");
  });
});
