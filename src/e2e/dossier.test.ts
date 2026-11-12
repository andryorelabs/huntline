import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isObject } from "../core/narrow.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
const CLI_ENTRY = path.join(REPO_ROOT, "src/cli.ts");
const FIXTURES = path.join(REPO_ROOT, "fixtures/dossier");

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

function useFixture(variant: "complete" | "partial"): void {
  cpSync(path.join(FIXTURES, variant, "dossier"), path.join(dataDir, "dossier"), {
    recursive: true,
  });
}

function errorOf(result: CliResult): Record<string, unknown> {
  const error = result.envelope["error"];
  if (!isObject(error)) throw new Error("envelope has no error");
  return error;
}

function sectionsOf(result: CliResult): Record<string, unknown>[] {
  const data = result.envelope["data"];
  if (!isObject(data) || !Array.isArray(data["sections"])) throw new Error("no sections");
  return data["sections"].filter(isObject);
}

beforeEach(() => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "jobship-dossier-e2e-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("jobship dossier check", () => {
  test("lists every section's status and sources for the complete fixture", () => {
    useFixture("complete");
    const result = runCli(["dossier", "check"]);
    expect(result.code).toBe(0);
    expect(sectionsOf(result)).toEqual([
      { name: "career", status: "complete", sources: ["cv", "interview"] },
      { name: "search", status: "complete", sources: ["interview"] },
      { name: "presence", status: "complete", sources: ["github", "linkedin"] },
      { name: "identity", status: "complete", sources: ["interview"] },
    ]);
  });

  test("reports mixed statuses for the partial fixture", () => {
    useFixture("partial");
    const result = runCli(["dossier", "check"]);
    expect(result.code).toBe(0);
    expect(sectionsOf(result).map((section) => section["status"])).toEqual([
      "complete",
      "partial",
      "empty",
      "empty",
    ]);
  });

  test("fails dossier-invalid for a tier C value, passes for readiness", () => {
    useFixture("complete");
    const identityPath = path.join(dataDir, "dossier", "identity.md");
    const original = readFileSync(identityPath, "utf8");
    writeFileSync(
      identityPath,
      original.replace("passportNumber [C]: ready: yes", "passportNumber [C]: X123"),
    );
    const bad = runCli(["dossier", "check"]);
    expect(bad.code).toBe(1);
    expect(errorOf(bad)["code"]).toBe("dossier-invalid");
    expect(String(errorOf(bad)["message"])).toContain("dossier/identity.md");
    writeFileSync(identityPath, original);
    expect(runCli(["dossier", "check"]).code).toBe(0);
  });

  test("fails dossier-invalid for an unknown section file", () => {
    useFixture("complete");
    writeFileSync(
      path.join(dataDir, "dossier", "hobbies.md"),
      "---\nstatus: empty\nsources: []\n---\n",
    );
    const result = runCli(["dossier", "check"]);
    expect(result.code).toBe(1);
    expect(String(errorOf(result)["message"])).toContain("dossier/hobbies.md");
  });

  test("fails usage without a subcommand", () => {
    useFixture("complete");
    const result = runCli(["dossier"]);
    expect(result.code).toBe(2);
    expect(errorOf(result)["code"]).toBe("usage");
  });
});
