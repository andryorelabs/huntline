import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import type { FetchLike } from "../tracker/linear.ts";
import type { CommandContext } from "./commands.ts";
import { listAnswers } from "../apply/answers.ts";
import { runDoctor } from "./doctor.ts";
import { runInit } from "./init.ts";
import { exitCodeFor } from "./envelope.ts";
import { isObject } from "./narrow.ts";

const RECOVERY =
  "claude plugin marketplace add andryorelabs/jobship && claude plugin install jobship@jobship-marketplace";

const COMPLETE_DOSSIER = path.resolve(import.meta.dir, "../../fixtures/dossier/complete/dossier");

let workDir = "";

function writeDerivedFiles(dir: string): void {
  writeFileSync(path.join(dir, "facts.yaml"), "facts:\n  - id: f1\n    text: Built a thing\n");
  writeFileSync(
    path.join(dir, "bullets.yaml"),
    "bullets:\n  - id: b1\n    text: Built a thing\n    facts: [f1]\n",
  );
}

function writeCompleteOnboarding(dir: string): void {
  cpSync(COMPLETE_DOSSIER, path.join(dir, "dossier"), { recursive: true });
  writeDerivedFiles(dir);
}

function writeDataDir(tracker: Record<string, unknown>): CommandContext {
  const dir = path.join(workDir, "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "jobship.json"), '{"version":1}\n');
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
      tracker,
    }),
  );
  writeCompleteOnboarding(dir);
  return {
    dataDir: { path: dir },
    env: { HOME: workDir, JOBSHIP_CATALOG_URL: "off" },
    cwd: workDir,
  };
}

function withEnv(ctx: CommandContext, env: Record<string, string>): CommandContext {
  return { ...ctx, env: { ...ctx.env, ...env } };
}

function guardOf(envelope: Awaited<ReturnType<typeof runDoctor>>): Record<string, unknown> {
  if (!envelope.ok) throw new Error(`doctor failed: ${envelope.error.message}`);
  const data = envelope.data;
  const guard = isObject(data) ? data["guard"] : undefined;
  if (!isObject(guard)) throw new Error("doctor data has no guard section");
  return guard;
}

function warningsOf(
  envelope: Awaited<ReturnType<typeof runDoctor>>,
): { code: string; recoveryAction: string }[] {
  if (!envelope.ok) throw new Error("doctor failed");
  const data = envelope.data;
  const warnings: unknown = isObject(data) ? data["warnings"] : undefined;
  if (!Array.isArray(warnings)) throw new Error("doctor data has no warnings");
  return warnings.map((warning: unknown) => {
    if (!isObject(warning)) throw new Error("warning is not an object");
    return { code: String(warning["code"]), recoveryAction: String(warning["recoveryAction"]) };
  });
}

function pluginsFile(contents: string, index = 0): string {
  const file = path.join(workDir, `installed_plugins_${index}.json`);
  writeFileSync(file, contents);
  return file;
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "jobship-doctor-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("doctor guard readiness", () => {
  test("a hook matcher that no longer covers the guarded tools fails doctor", async () => {
    const brokenHooks = { hooks: { PreToolUse: [{ matcher: "Read", hooks: [] }] } };
    const envelope = await runDoctor(writeDataDir({ kind: "local" }), { guardHooks: brokenHooks });
    expect(envelope.ok).toBe(false);
    expect(exitCodeFor(envelope)).toBe(1);
    expect(JSON.stringify(envelope)).toContain("guard-self-test-failed");
  });

  test("a missing plugins file warns with the recovery action and still succeeds", async () => {
    const ctx = withEnv(writeDataDir({ kind: "local" }), {
      JOBSHIP_CLAUDE_PLUGINS_FILE: path.join(workDir, "absent.json"),
    });
    const envelope = await runDoctor(ctx);
    expect(envelope.ok).toBe(true);
    expect(guardOf(envelope)).toEqual({ selfTest: "pass", pluginInstalled: false });
    const [warning] = warningsOf(envelope);
    expect(warning?.recoveryAction).toBe(RECOVERY);
  });

  test("a plugins file without a jobship entry warns", async () => {
    const file = pluginsFile(JSON.stringify({ version: 2, plugins: { "other@market": [{}] } }));
    const envelope = await runDoctor(
      withEnv(writeDataDir({ kind: "local" }), { JOBSHIP_CLAUDE_PLUGINS_FILE: file }),
    );
    expect(envelope.ok).toBe(true);
    expect(guardOf(envelope)["pluginInstalled"]).toBe(false);
    expect(warningsOf(envelope)[0]?.recoveryAction).toBe(RECOVERY);
  });

  test("a jobship@ entry read through JOBSHIP_CLAUDE_PLUGINS_FILE means installed", async () => {
    const file = pluginsFile(
      JSON.stringify({ version: 2, plugins: { "jobship@jobship-marketplace": [{}] } }),
    );
    const envelope = await runDoctor(
      withEnv(writeDataDir({ kind: "local" }), {
        JOBSHIP_CLAUDE_PLUGINS_FILE: file,
      }),
    );
    expect(guardOf(envelope)).toEqual({ selfTest: "pass", pluginInstalled: true });
    expect(warningsOf(envelope)).toEqual([]);
  });

  test("a huntline@ entry is not the jobship plugin", async () => {
    const file = pluginsFile(
      JSON.stringify({ version: 2, plugins: { "huntline@acme-market": [{}] } }),
    );
    const envelope = await runDoctor(
      withEnv(writeDataDir({ kind: "local" }), { JOBSHIP_CLAUDE_PLUGINS_FILE: file }),
    );
    expect(guardOf(envelope)["pluginInstalled"]).toBe(false);
  });

  test("a malformed plugins file warns instead of crashing", async () => {
    const ctx = writeDataDir({ kind: "local" });
    const files = ["{oops", "null", "[]", '{"plugins": 3}'].map((contents, index) =>
      pluginsFile(contents, index),
    );
    const envelopes = await Promise.all(
      files.map((file) => runDoctor(withEnv(ctx, { JOBSHIP_CLAUDE_PLUGINS_FILE: file }))),
    );
    for (const envelope of envelopes) {
      expect(envelope.ok).toBe(true);
      expect(guardOf(envelope)["pluginInstalled"]).toBe(false);
      expect(warningsOf(envelope).length).toBeGreaterThan(0);
    }
  });

  test("defaults to ~/.claude/plugins/installed_plugins.json under HOME", async () => {
    const ctx = writeDataDir({ kind: "local" });
    mkdirSync(path.join(workDir, ".claude/plugins"), { recursive: true });
    writeFileSync(
      path.join(workDir, ".claude/plugins/installed_plugins.json"),
      JSON.stringify({ plugins: { "jobship@acme-market": [] } }),
    );
    expect(guardOf(await runDoctor(ctx))["pluginInstalled"]).toBe(true);
  });
});

const failingFetch = (): FetchLike => () =>
  Promise.reject(new Error("network must not be touched"));

const WORKFLOW_NAMES = ["Backlog", "Todo", "In Progress", "Done", "Canceled"];

function teamFetch(names: readonly string[]): FetchLike {
  return () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            teams: {
              nodes: [
                {
                  id: "t1",
                  key: "JOB",
                  states: { nodes: names.map((name, i) => ({ id: `s${i}`, name })) },
                },
              ],
            },
          },
        }),
        { status: 200 },
      ),
    );
}

describe("doctor linear readiness", () => {
  const linearTracker = { kind: "linear", team: "JOB" };

  test("local tracker never touches the network", async () => {
    const envelope = await runDoctor(writeDataDir({ kind: "local" }), { fetch: failingFetch() });
    expect(envelope.ok).toBe(true);
  });

  test("linear without LINEAR_API_KEY fails with linear-not-ready", async () => {
    const envelope = await runDoctor(writeDataDir(linearTracker), { fetch: failingFetch() });
    expect(envelope.ok).toBe(false);
    if (envelope.ok) return;
    expect(envelope.error.code).toBe("linear-not-ready");
    expect(envelope.error.message).toContain("LINEAR_API_KEY");
    expect(exitCodeFor(envelope)).toBe(1);
  });

  test("lists every problem when the team lacks mapped states", async () => {
    const fetchStub = teamFetch(["Backlog"]);
    const ctx = withEnv(writeDataDir(linearTracker), { LINEAR_API_KEY: "lin_api_synthetic" });
    const envelope = await runDoctor(ctx, { fetch: fetchStub });
    expect(envelope.ok).toBe(false);
    if (envelope.ok) return;
    expect(envelope.error.code).toBe("linear-not-ready");
    expect(envelope.error.message).toContain('state "In Progress" not found in team JOB');
    expect(envelope.error.message).toContain('state "Done" not found in team JOB');
  });

  test("passes when the fixture team has every mapped state", async () => {
    const fetchStub = teamFetch(WORKFLOW_NAMES);
    const ctx = withEnv(writeDataDir(linearTracker), { LINEAR_API_KEY: "lin_api_synthetic" });
    const envelope = await runDoctor(ctx, { fetch: fetchStub });
    expect(envelope.ok).toBe(true);
  });
});

function dataFile(ctx: CommandContext, name: string): string {
  return path.join(ctx.dataDir?.path ?? "", name);
}

function rewriteProfile(ctx: CommandContext, patch: Record<string, unknown>): void {
  const file = dataFile(ctx, "profile.yaml");
  const profile: unknown = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...(isObject(profile) ? profile : {}), ...patch }));
}

describe("doctor data checks", () => {
  test("warns about unknown profile keys and passes", async () => {
    const ctx = writeDataDir({ kind: "local" });
    rewriteProfile(ctx, { foo: 1 });
    const result = await runDoctor(ctx);
    expect(result.ok).toBe(true);
    const data = result.ok && isObject(result.data) ? result.data : {};
    expect(JSON.stringify(data["warnings"])).toContain("foo");
  });

  test("fails naming the events.jsonl line that is not JSON", async () => {
    const ctx = writeDataDir({ kind: "local" });
    writeFileSync(dataFile(ctx, "events.jsonl"), '{"a":1}\n{"b":2}\nnope\n');
    const result = await runDoctor(ctx);
    expect(result.ok ? "" : result.error.message).toContain("line 3");
  });

  test("fails on malformed companies.json and answers.json", async () => {
    const ctx = writeDataDir({ kind: "local" });
    writeFileSync(dataFile(ctx, "companies.json"), "{");
    writeFileSync(dataFile(ctx, "answers.json"), "[");
    const result = await runDoctor(ctx);
    const message = result.ok ? "" : result.error.message;
    expect(message).toContain("companies.json");
    expect(message).toContain("answers.json");
  });

  test("fails on an unknown Source name", async () => {
    const ctx = writeDataDir({ kind: "local" });
    rewriteProfile(ctx, { sources: ["linkedn"] });
    const result = await runDoctor(ctx);
    expect(result.ok ? "" : result.error.message).toContain("linkedn");
  });

  test("warns no-boards when the sources resolve to no feed board", async () => {
    const ctx = writeDataDir({ kind: "local" });
    rewriteProfile(ctx, { sources: ["linkedin"] });
    const result = await runDoctor(ctx);
    expect(warningsOf(result).map((warning) => warning.code)).toContain("no-boards");
  });

  test("does not warn no-boards when empty sources resolve feed boards", async () => {
    const ctx = writeDataDir({ kind: "local" });
    const result = await runDoctor(ctx);
    expect(warningsOf(result).map((warning) => warning.code)).not.toContain("no-boards");
  });

  test("warns when an ATS Source has no saved company", async () => {
    const ctx = writeDataDir({ kind: "local" });
    rewriteProfile(ctx, { sources: ["greenhouse", "remoteok"] });
    const result = await runDoctor(ctx);
    expect(warningsOf(result).map((warning) => warning.code)).toContain("ats-without-companies");
    writeFileSync(
      dataFile(ctx, "companies.json"),
      JSON.stringify({ companies: [{ ats: "greenhouse", slug: "acme" }] }),
    );
    const after = await runDoctor(ctx);
    expect(warningsOf(after).map((warning) => warning.code)).not.toContain("ats-without-companies");
  });
});

describe("init scaffold", () => {
  test("writes cv/template.typ and an empty answers.json", async () => {
    const fresh = path.join(workDir, "fresh");
    const result = await runInit(["--data", fresh], workDir);
    expect(result.ok).toBe(true);
    expect(existsSync(path.join(fresh, "cv", "template.typ"))).toBe(true);
    expect(listAnswers({ path: fresh })).toEqual([]);
  });
});

describe("doctor onboarding checks", () => {
  test("a freshly scaffolded data dir fails dossier-incomplete listing all four sections", async () => {
    const fresh = path.join(workDir, "fresh");
    await runInit(["--data", fresh], workDir);
    const result = await runDoctor({ dataDir: { path: fresh }, env: {}, cwd: workDir });
    expect(result.ok).toBe(false);
    const error = result.ok ? null : result.error;
    expect(error?.code).toBe("dossier-incomplete");
    for (const section of ["career", "search", "presence", "identity"]) {
      expect(error?.message).toContain(section);
    }
  });

  test("a partial Dossier fails dossier-incomplete naming only the unfinished sections", async () => {
    const ctx = writeDataDir({ kind: "local" });
    const career = dataFile(ctx, "dossier/career.md");
    writeFileSync(
      career,
      readFileSync(career, "utf8").replace("status: complete", "status: partial"),
    );
    const result = await runDoctor(ctx);
    expect(result.ok ? "" : result.error.code).toBe("dossier-incomplete");
    expect(result.ok ? "" : result.error.message).toContain("career (partial)");
    expect(result.ok ? "" : result.error.message).not.toContain("search");
  });

  test("a complete Dossier with empty derived files fails derived-empty", async () => {
    const ctx = writeDataDir({ kind: "local" });
    writeFileSync(dataFile(ctx, "facts.yaml"), "facts: []\n");
    writeFileSync(dataFile(ctx, "bullets.yaml"), "bullets: []\n");
    rewriteProfile(ctx, { regions: [] });
    const result = await runDoctor(ctx);
    expect(result.ok ? "" : result.error.code).toBe("derived-empty");
    for (const name of ["Fact bank", "Bullets", "Profile regions"]) {
      expect(result.ok ? "" : result.error.message).toContain(name);
    }
  });

  test("a complete Dossier and derived files report ok", async () => {
    const result = await runDoctor(writeDataDir({ kind: "local" }));
    expect(result.ok).toBe(true);
  });
});

describe("init scaffold of the Dossier", () => {
  test("writes the four Dossier sections and a .gitignore listing identity.md", async () => {
    const fresh = path.join(workDir, "fresh");
    const result = await runInit(["--data", fresh], workDir);
    expect(result.ok).toBe(true);
    for (const name of ["career", "search", "presence", "identity"]) {
      const text = readFileSync(path.join(fresh, "dossier", `${name}.md`), "utf8");
      expect(text).toContain("status: empty");
      expect(text).toContain("sources: []");
    }
    expect(readFileSync(path.join(fresh, ".gitignore"), "utf8")).toContain("dossier/identity.md");
  });

  test("no scaffolded file carries the retired marker", async () => {
    const fresh = path.join(workDir, "fresh");
    await runInit(["--data", fresh], workDir);
    const found = new Bun.Glob("**/*").scanSync({ cwd: fresh, dot: true });
    for (const name of found) {
      expect(readFileSync(path.join(fresh, name), "utf8")).not.toContain("TODO(jobship):");
    }
  });

  test("an existing .gitignore is kept without --force and replaced with it", async () => {
    const fresh = path.join(workDir, "fresh");
    mkdirSync(fresh, { recursive: true });
    writeFileSync(path.join(fresh, ".gitignore"), "mine\n");
    const refused = await runInit(["--data", fresh], workDir);
    expect(refused.ok ? "" : refused.error.code).toBe("already-exists");
    expect(readFileSync(path.join(fresh, ".gitignore"), "utf8")).toBe("mine\n");
    const forced = await runInit(["--data", fresh, "--force"], workDir);
    expect(forced.ok).toBe(true);
    expect(readFileSync(path.join(fresh, ".gitignore"), "utf8")).toContain("dossier/identity.md");
  });

  test("--missing adds only absent files and keeps existing data", async () => {
    const fresh = path.join(workDir, "fresh");
    mkdirSync(fresh, { recursive: true });
    writeFileSync(path.join(fresh, "profile.yaml"), "kept: true\n");
    const added = await runInit(["--data", fresh, "--missing"], workDir);
    expect(added.ok).toBe(true);
    expect(readFileSync(path.join(fresh, "profile.yaml"), "utf8")).toBe("kept: true\n");
    expect(readFileSync(path.join(fresh, "dossier/career.md"), "utf8")).toContain("status: empty");
    const written = added.ok && isObject(added.data) ? added.data["written"] : [];
    expect(written).not.toContain("profile.yaml");
  });

  test("--missing appends the identity file to an existing .gitignore that lacks it", async () => {
    const fresh = path.join(workDir, "fresh");
    mkdirSync(fresh, { recursive: true });
    writeFileSync(path.join(fresh, ".gitignore"), "*.pdf");
    const added = await runInit(["--data", fresh, "--missing"], workDir);
    expect(added.ok).toBe(true);
    expect(readFileSync(path.join(fresh, ".gitignore"), "utf8")).toBe(
      "*.pdf\ndossier/identity.md\n",
    );
    const updated = added.ok && isObject(added.data) ? added.data["updated"] : [];
    expect(updated).toEqual([".gitignore"]);
    const again = await runInit(["--data", fresh, "--missing"], workDir);
    expect(readFileSync(path.join(fresh, ".gitignore"), "utf8")).toBe(
      "*.pdf\ndossier/identity.md\n",
    );
    expect(again.ok && isObject(again.data) ? again.data["updated"] : null).toEqual([]);
  });

  test("--missing and --force together are a usage error", async () => {
    const result = await runInit(
      ["--data", path.join(workDir, "x"), "--missing", "--force"],
      workDir,
    );
    expect(result.ok ? "" : result.error.code).toBe("usage");
  });
});

describe("doctor on a data dir without a Dossier", () => {
  test("fails dossier-incomplete listing every section as missing", async () => {
    const ctx = writeDataDir({ kind: "local" });
    rmSync(dataFile(ctx, "dossier"), { recursive: true, force: true });
    const result = await runDoctor(ctx);
    expect(result.ok ? "" : result.error.code).toBe("dossier-incomplete");
    for (const section of ["career", "search", "presence", "identity"]) {
      expect(result.ok ? "" : result.error.message).toContain(`${section} (missing)`);
    }
    expect(result.ok ? "" : (result.error.recoveryAction ?? "")).toContain("--missing");
  });
});
