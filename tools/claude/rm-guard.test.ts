import { describe, expect, test } from "bun:test";
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
  ])("allows %s", (command) => {
    expect(decideRm(command, repoRoot)).toBe("allow");
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

  test("stays silent when there is no command", async () => {
    const result = await runHook(JSON.stringify({ tool_name: "Read", tool_input: {} }));
    expect(result.stdout).toBe("");
  });
});
