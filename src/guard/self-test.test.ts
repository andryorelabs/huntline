import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { exitCodeFor } from "../core/envelope.ts";
import { isObject } from "../core/narrow.ts";
import { run, selfTestEnvelope } from "./command.ts";
import { decideGuard, type GuardDecision } from "./decide.ts";
import { runGuardSelfTest, SELF_TEST_HOOKS } from "./self-test.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const REAL_HOOKS: unknown = JSON.parse(readFileSync(path.join(ROOT, "hooks/hooks.json"), "utf8"));

const allowEverything = (): GuardDecision => ({ decision: "allow" });

describe("runGuardSelfTest", () => {
  test("passes on the real hooks.json and lists every required case", () => {
    const result = runGuardSelfTest(REAL_HOOKS);
    expect(result.pass).toBe(true);
    for (const entry of result.cases) {
      expect(entry.actual).toBe(entry.expected);
    }
    const tools = result.cases.map((entry) => entry.tool);
    expect(tools).toContain("mcp__user-chrome__click");
    expect(tools).toContain("mcp__chrome-devtools__click");
    expect(tools).toContain("mcp__chrome-devtools__press_key");
    expect(tools).toContain("mcp__chrome-devtools__evaluate_script");
    expect(tools).toContain("mcp__claude_ai_Gmail__send_message");
    const snapshot = result.cases.find((entry) => entry.tool.endsWith("take_snapshot"));
    expect(snapshot?.expected).toBe("allow");
  });

  test("embeds the shipped hooks.json that is on disk", () => {
    expect(SELF_TEST_HOOKS).toEqual(REAL_HOOKS);
    const source = readFileSync(path.join(ROOT, "src/guard/self-test.ts"), "utf8");
    expect(source).toMatch(/from "\.\.\/\.\.\/hooks\/hooks\.json" with \{ type: "json" \}/);
  });

  test("names the case whose decision is changed to allow", () => {
    const result = runGuardSelfTest(REAL_HOOKS, allowEverything);
    expect(result.pass).toBe(false);
    const failed = result.cases.filter((entry) => !entry.pass);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((entry) => entry.expected === "deny" && entry.actual === "allow")).toBe(
      true,
    );
  });

  test("a hook matcher that does not cover a denied tool fails that case", () => {
    const narrowed = {
      hooks: { PreToolUse: [{ matcher: "mcp__.*Gmail.*", hooks: [] }] },
    };
    const result = runGuardSelfTest(narrowed);
    expect(result.pass).toBe(false);
    const click = result.cases.find((entry) => entry.tool === "mcp__user-chrome__click");
    expect(click?.matcherCovers).toBe(false);
    expect(click?.pass).toBe(false);
    const gmail = result.cases.find((entry) => entry.tool.includes("Gmail"));
    expect(gmail?.pass).toBe(true);
  });

  test("fails closed on malformed hooks input without throwing", () => {
    for (const bad of [
      null,
      undefined,
      42,
      "x",
      {},
      { hooks: {} },
      { hooks: { PreToolUse: [{ matcher: "(" }] } },
    ]) {
      const result = runGuardSelfTest(bad);
      expect(result.pass).toBe(false);
    }
  });

  test("uses the real decideGuard by default", () => {
    const result = runGuardSelfTest(REAL_HOOKS, decideGuard);
    expect(result.pass).toBe(true);
  });
});

describe("dogfooding checklist", () => {
  const dogfooding = readFileSync(path.join(ROOT, "docs/guide/dogfooding.md"), "utf8");
  const cli = readFileSync(path.join(ROOT, "docs/reference/cli.md"), "utf8");

  test("every command it names exists in the CLI reference", () => {
    const named = new Set<string>();
    for (const match of dogfooding.matchAll(/`huntline ([a-z]+)/g)) {
      if (match[1] !== undefined) named.add(match[1]);
    }
    expect(named.size).toBeGreaterThan(3);
    for (const command of named) expect(cli).toContain(`### \`huntline ${command}`);
  });

  test("is linked from the README and the install guide", () => {
    for (const file of ["README.md", "docs/guide/install.md"]) {
      expect(readFileSync(path.join(ROOT, file), "utf8")).toContain("dogfooding.md");
    }
  });
});

describe("guard --self-test", () => {
  test("runs through the CLI and exits 0 with an envelope listing the cases", () => {
    const spawned = Bun.spawnSync(
      [process.execPath, path.join(ROOT, "src/cli.ts"), "guard", "--self-test"],
      { env: { PATH: process.env["PATH"] ?? "" } },
    );
    expect(spawned.exitCode).toBe(0);
    const envelope: unknown = JSON.parse(spawned.stdout.toString());
    if (!isObject(envelope)) throw new Error("envelope is not an object");
    expect(envelope["ok"]).toBe(true);
    const cases = isObject(envelope["data"]) ? envelope["data"]["cases"] : undefined;
    expect(Array.isArray(cases) ? cases.length : 0).toBeGreaterThanOrEqual(5);
  });

  test("run returns ok on current code", async () => {
    const envelope = await run(["--self-test"], { dataDir: null, env: {}, cwd: "/" });
    expect(envelope.ok).toBe(true);
  });

  test("a failing result becomes a guard-self-test-failed envelope naming the case", () => {
    const result = runGuardSelfTest(REAL_HOOKS, () => ({ decision: "allow" }));
    const envelope = selfTestEnvelope(result);
    expect(envelope.ok).toBe(false);
    if (envelope.ok) return;
    expect(envelope.error.code).toBe("guard-self-test-failed");
    expect(envelope.error.message).toContain("press_key Enter");
    expect(exitCodeFor(envelope)).toBe(1);
  });
});
