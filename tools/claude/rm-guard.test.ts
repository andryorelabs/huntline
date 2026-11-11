import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { decideRm } from "./rm-guard.ts";

const repoRoot = "/work/repo";
const mainPath = path.resolve(import.meta.dir, "main.ts");

async function runHook(stdin: string): Promise<{ stdout: string; exitCode: number }> {
  const processHandle = Bun.spawn(["bun", mainPath], {
    stdin: new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
  });
  const stdout = await new Response(processHandle.stdout).text();
  return { stdout, exitCode: await processHandle.exited };
}

describe("decideRm", () => {
  test.each([
    "rm -rf /",
    "rm -rf /etc",
    "rm -rf /work/repo",
    "rm -rf .",
    "rm -rf ./",
    "rm -rf ..",
    "rm -rf ../other",
    "rm -rf /work/repo/../other",
    "rm -rf /work/repo-sibling",
    "rm -fr /tmp/x",
    "rm -Rf /tmp/x",
    "rm -r -f /tmp/x",
    "rm --recursive --force /tmp/x",
    "rm -r /tmp/x",
    "rm -rf",
    "rm -rf $HOME",
    "rm -rf ~/x",
    "rm -rf src/*",
    "rm -rf src /etc",
    "cd src && rm -rf /etc",
    "echo hi; rm -rf /etc",
    "sudo rm -rf /etc",
    "xargs rm -rf /etc",
    "\\rm -rf /etc",
    "/bin/rm -rf /etc",
    "sh -c 'rm -rf /etc'",
    "find . -exec rm -rf /etc {} +",
    "rm -rf \\\n/etc",
    "rm -rf build \\\n  /etc",
    "cd /tmp && rm -rf build",
    "cd .. && rm -rf repo",
    "pushd /tmp; rm -rf build",
    'rm -rf "/etc"',
    "rm -rf '/etc'",
    "rm -rf -- /etc",
    "rm -rf \\/etc",
    "bash -lc 'rm -rf /etc'",
    "sh -ec 'rm -rf /etc'",
    "eval 'rm -rf /etc'",
    "eval rm -rf /etc",
    'echo "$(rm -rf /etc)"',
    "echo $(rm -rf /etc)",
    "rm --rec /etc",
    "rm --recurs --force /etc",
    "rm -rf 'unterminated",
    'rm -rf "unterminated',
    "rm -rf build; rm -rf /etc > /dev/null",
  ])("denies %s", (command) => {
    expect(decideRm(command, repoRoot)).toBe("deny");
  });

  test.each([
    "rm -rf build",
    "rm -rf ./build/cache",
    "rm -rf /work/repo/dist",
    "rm -rf -- dist",
    "rm -rf dist node_modules",
    "rm file.txt",
    "rm -f /etc/x",
    "git rm -r src",
    "echo rm -rf /",
    "ls /etc",
    "bun run check",
    "rm -rf build > /dev/null 2>&1",
    "rm -rf build 2>/dev/null",
    "rm -rf build &> /dev/null",
    "rm -rf build >&2",
    'rm -rf "build dir"',
    'rm -rf "a;b"',
    "bash -lc 'echo hi'",
    "eval 'echo hi'",
    "rm --rec build",
    "rm -rf build \\\n  dist",
  ])("allows %s", (command) => {
    expect(decideRm(command, repoRoot)).toBe("allow");
  });

  test("resolves relative targets against the given cwd", () => {
    expect(decideRm("rm -rf build", repoRoot, "/tmp")).toBe("deny");
    expect(decideRm("rm -rf ..", repoRoot, "/work/repo/sub")).toBe("deny");
    expect(decideRm("rm -rf ../sub/build", repoRoot, "/work/repo/sub")).toBe("allow");
  });
});

describe("decideRm with symlinks", () => {
  let sandbox = "";
  let root = "";

  beforeEach(() => {
    sandbox = realpathSync(mkdtempSync(path.join(os.tmpdir(), "rm-guard-")));
    root = path.join(sandbox, "repo");
    mkdirSync(path.join(root, "inside"), { recursive: true });
    mkdirSync(path.join(sandbox, "outside", "data"), { recursive: true });
    symlinkSync(path.join(sandbox, "outside"), path.join(root, "escape"));
    symlinkSync(path.join(root, "inside"), path.join(root, "alias"));
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  test("denies a recursive rm through an in-repo symlink that points outside", () => {
    expect(decideRm("rm -rf escape/data", root)).toBe("deny");
    expect(decideRm("rm -rf ./escape/data", root)).toBe("deny");
    expect(decideRm("rm -rf escape/../outside/data", root)).toBe("deny");
    expect(decideRm("rm -rf escape/missing", root)).toBe("deny");
  });

  test("denies the symlink to the outside itself", () => {
    expect(decideRm("rm -rf escape", root)).toBe("deny");
  });

  test("allows paths through a symlink that stays inside", () => {
    expect(decideRm("rm -rf alias/missing", root)).toBe("allow");
  });

  test("allows a missing path inside the repository", () => {
    expect(decideRm("rm -rf dist/cache", root)).toBe("allow");
  });
});

describe("hook entry", () => {
  test("denies a recursive rm outside the repository", async () => {
    const result = await runHook(
      JSON.stringify({ tool_name: "Bash", tool_input: { command: "rm -rf /etc" } }),
    );
    expect(result.stdout).toContain('"hookEventName":"PreToolUse"');
    expect(result.stdout).toContain('"permissionDecision":"deny"');
    expect(result.exitCode).toBe(0);
  });

  test("denies the repository root", async () => {
    const result = await runHook(
      JSON.stringify({ tool_name: "Bash", tool_input: { command: "rm -rf /work/repo" } }),
    );
    expect(result.stdout).toContain('"permissionDecision":"deny"');
  });

  test("denies malformed JSON", async () => {
    const result = await runHook("{not json");
    expect(result.stdout).toContain('"permissionDecision":"deny"');
  });

  test("denies a non-object payload", async () => {
    const result = await runHook("42");
    expect(result.stdout).toContain('"permissionDecision":"deny"');
  });

  test("stays silent for an allowed command", async () => {
    const result = await runHook(
      JSON.stringify({ tool_name: "Bash", tool_input: { command: "rm -rf build" } }),
    );
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });

  test("resolves relative targets against the payload cwd", async () => {
    const outside = await runHook(
      JSON.stringify({ cwd: "/tmp", tool_name: "Bash", tool_input: { command: "rm -rf build" } }),
    );
    expect(outside.stdout).toContain('"permissionDecision":"deny"');
    const inside = await runHook(
      JSON.stringify({
        cwd: "/work/repo/sub",
        tool_name: "Bash",
        tool_input: { command: "rm -rf build" },
      }),
    );
    expect(inside.stdout).toBe("");
  });

  test("denies a cd before a recursive rm", async () => {
    const result = await runHook(
      JSON.stringify({
        cwd: "/work/repo",
        tool_name: "Bash",
        tool_input: { command: "cd /tmp && rm -rf build" },
      }),
    );
    expect(result.stdout).toContain('"permissionDecision":"deny"');
  });

  test("stays silent when there is no command", async () => {
    const result = await runHook(JSON.stringify({ tool_name: "Read", tool_input: {} }));
    expect(result.stdout).toBe("");
  });
});
