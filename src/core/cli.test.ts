import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { MODULE_FILES } from "../cli.ts";
import { COMMANDS } from "./commands.ts";

const cliPath = path.join(import.meta.dir, "../cli.ts");

let workDir = "";

type CliResult = { code: number; stdout: string; envelope: Record<string, unknown> };

function runCli(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}): CliResult {
  const result = Bun.spawnSync([process.execPath, cliPath, ...args], {
    cwd: options.cwd ?? workDir,
    env: { PATH: process.env["PATH"] ?? "", HOME: workDir, ...options.env },
  });
  const stdout = result.stdout.toString();
  const lines = stdout.split("\n").filter((line) => line !== "");
  expect(lines).toHaveLength(1);
  const envelope: unknown = JSON.parse(lines[0] ?? "");
  if (typeof envelope !== "object" || envelope === null) throw new Error("not an object");
  return { code: result.exitCode, stdout, envelope: { ...envelope } };
}

function errorOf(result: CliResult): { code: string; message: string } {
  const error = result.envelope["error"];
  if (typeof error !== "object" || error === null) throw new Error("no error in envelope");
  const { code, message } = error as Record<string, unknown>;
  return { code: String(code), message: String(message) };
}

function writeValidDataDir(dir: string, profileOverrides: Record<string, unknown> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "huntline.json"), '{"version":1}\n');
  writeFileSync(
    path.join(dir, "profile.yaml"),
    JSON.stringify({
      regions: ["LATAM"],
      contractTypes: ["full-time"],
      remote: "remote-only",
      stack: { include: ["typescript"], exclude: [] },
      salaryFloor: null,
      excludedCompanies: [],
      outreachDailyCap: 5,
      sources: [],
      tracker: { kind: "local" },
      ...profileOverrides,
    }),
  );
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "huntline-cli-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("doctor", () => {
  test("a valid data dir prints ok and exits 0", () => {
    const fixture = path.join(workDir, "fixture");
    writeValidDataDir(fixture);
    const result = runCli(["doctor", "--data", fixture]);
    expect(result.code).toBe(0);
    expect(result.envelope["ok"]).toBe(true);
  });

  test("HUNTLINE_HOME and upward search resolve the data dir", () => {
    const fixture = path.join(workDir, "fixture");
    writeValidDataDir(fixture);
    expect(runCli(["doctor"], { env: { HUNTLINE_HOME: fixture } }).code).toBe(0);
    const nested = path.join(fixture, "deep");
    mkdirSync(nested);
    expect(runCli(["doctor"], { cwd: nested }).code).toBe(0);
  });

  test("a malformed Profile exits 2 with an error code", () => {
    const fixture = path.join(workDir, "fixture");
    writeValidDataDir(fixture);
    writeFileSync(path.join(fixture, "profile.yaml"), "regions: [unterminated\n");
    const result = runCli(["doctor", "--data", fixture]);
    expect(result.code).toBe(2);
    expect(errorOf(result).code).toBe("profile-malformed");
  });

  test("an unknown contract type exits 2 naming the field", () => {
    const fixture = path.join(workDir, "fixture");
    writeValidDataDir(fixture, { contractTypes: ["full-time", "gig"] });
    const result = runCli(["doctor", "--data", fixture]);
    expect(result.code).toBe(2);
    expect(errorOf(result).message).toContain("contractTypes[1]");
  });

  test("a missing Profile and a missing data dir exit 2", () => {
    const fixture = path.join(workDir, "fixture");
    mkdirSync(fixture);
    expect(errorOf(runCli(["doctor", "--data", fixture])).code).toBe("profile-missing");
    const lost = runCli(["doctor", "--data", path.join(workDir, "absent")]);
    expect(lost.code).toBe(2);
    expect(errorOf(lost).code).toBe("data-dir-not-found");
    expect(runCli(["doctor"]).code).toBe(2);
  });

  test("remaining markers exit 1 listing each file and line", () => {
    const fixture = path.join(workDir, "fixture");
    writeValidDataDir(fixture);
    writeFileSync(path.join(fixture, "facts.yaml"), "# TODO(huntline): fill\nfacts: []\n");
    const result = runCli(["doctor", "--data", fixture]);
    expect(result.code).toBe(1);
    expect(errorOf(result).code).toBe("todo-markers");
    expect(errorOf(result).message).toContain("facts.yaml:1");
  });
});

describe("init", () => {
  test("scaffolds the templates, doctor exits 1 on markers, and init refuses to overwrite", () => {
    const created = runCli(["init"]);
    expect(created.code).toBe(0);
    for (const name of [
      "huntline.json",
      "profile.yaml",
      "facts.yaml",
      "bullets.yaml",
      "never-claim.yaml",
      "answers.yaml",
    ]) {
      expect(readFileSync(path.join(workDir, name), "utf8").length).toBeGreaterThan(0);
    }

    const checked = runCli(["doctor"]);
    expect(checked.code).toBe(1);
    expect(errorOf(checked).code).toBe("todo-markers");
    expect(errorOf(checked).message).toContain("profile.yaml");

    writeFileSync(path.join(workDir, "profile.yaml"), "kept: true\n");
    const refused = runCli(["init"]);
    expect(refused.code).toBe(1);
    expect(errorOf(refused).code).toBe("already-exists");
    expect(readFileSync(path.join(workDir, "profile.yaml"), "utf8")).toBe("kept: true\n");

    expect(runCli(["init", "--force"]).code).toBe(0);
    expect(readFileSync(path.join(workDir, "profile.yaml"), "utf8")).toContain("regions");
  });

  test("scaffolds into --data", () => {
    const target = path.join(workDir, "fresh");
    expect(runCli(["init", "--data", target]).code).toBe(0);
    expect(readFileSync(path.join(target, "huntline.json"), "utf8")).toContain("version");
  });
});

describe("stub commands", () => {
  const invocations: string[][] = [
    ["sweep"],
    ["ingest"],
    ["score", "k"],
    ["company", "add", "https://jobs.example.test/acme"],
    ["apply", "answer", "q"],
    ["apply", "verify"],
    ["apply", "block"],
    ["needs"],
    ["inbox", "propose"],
    ["inbox", "apply", "batch"],
    ["inbox", "eval"],
    ["outreach", "lint"],
    ["outreach", "log"],
    ["interview", "pack", "k"],
    ["migrate", "legacy", "dir"],
    ["migrate", "linear"],
  ];

  for (const args of invocations) {
    test(`${args.join(" ")} prints not-implemented and exits 1`, () => {
      const result = runCli(args);
      expect(result.code).toBe(1);
      expect(errorOf(result).code).toBe("not-implemented");
    });
  }

  test("commands sharing a module are told apart by their command word", () => {
    const fixture = path.join(workDir, "fixture");
    writeValidDataDir(fixture);
    const events = runCli(["events", "list", "--data", fixture]);
    const ledger = runCli(["ledger", "list", "--data", fixture]);
    expect(events.code).toBe(0);
    expect(ledger.code).toBe(0);
    expect(events.envelope["data"]).toHaveProperty("events");
    expect(ledger.envelope["data"]).toHaveProperty("entries");
  });

  test("an unknown command exits 2", () => {
    const result = runCli(["frobnicate"]);
    expect(result.code).toBe(2);
    expect(errorOf(result).code).toBe("unknown-command");
  });

  test("every command table target has a loader", () => {
    expect([...MODULE_FILES].toSorted()).toEqual([...new Set(Object.values(COMMANDS))].toSorted());
  });
});

describe("version", () => {
  test("prints the dev version envelope", () => {
    const result = runCli(["--version"]);
    expect(result.code).toBe(0);
    expect(result.envelope["data"]).toEqual({ version: "0.0.0-dev" });
  });
});
