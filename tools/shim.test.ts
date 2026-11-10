import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { isObject } from "../src/core/narrow.ts";

const shimSource = path.resolve(import.meta.dir, "../bin/huntline");
const hooksSource = path.resolve(import.meta.dir, "../hooks/hooks.json");
const clickPayload = JSON.stringify({
  hook_event_name: "PreToolUse",
  session_id: "s1",
  tool_name: "mcp__chrome-devtools__click",
  tool_input: { uid: "1_1" },
});
const version = "9.9.9";
const platform = process.platform === "darwin" ? "darwin" : "linux";
const arch = process.arch === "arm64" ? "arm64" : "x64";
const assetName = `huntline-${platform}-${arch}`;
const fixtureBody = '#!/bin/sh\necho "fixture-binary $*"\n';

let workDir = "";
let pluginRoot = "";
let cacheDir = "";
let releaseDir = "";

function denyReasonOf(stdout: string): string {
  expect(stdout.endsWith("\n")).toBe(true);
  expect(stdout.trim().split("\n")).toHaveLength(1);
  const parsed: unknown = JSON.parse(stdout);
  const fields = isObject(parsed) ? parsed["hookSpecificOutput"] : undefined;
  if (!isObject(fields)) throw new Error("no hookSpecificOutput");
  expect(fields["hookEventName"]).toBe("PreToolUse");
  expect(fields["permissionDecision"]).toBe("deny");
  const reason = fields["permissionDecisionReason"];
  if (typeof reason !== "string") throw new Error("no permissionDecisionReason");
  return reason;
}

function cacheBinary(body: string): void {
  mkdirSync(path.join(cacheDir, version), { recursive: true });
  const cached = path.join(cacheDir, version, "huntline");
  writeFileSync(cached, body);
  chmodSync(cached, 0o755);
}

function fakeCommand(name: string, body: string): string {
  const fakeBin = path.join(workDir, "fake-bin");
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(path.join(fakeBin, name), body);
  chmodSync(path.join(fakeBin, name), 0o755);
  return `${fakeBin}:${process.env["PATH"] ?? ""}`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function publishRelease(options: { checksum?: string; listAsset?: boolean } = {}): void {
  mkdirSync(releaseDir, { recursive: true });
  writeFileSync(path.join(releaseDir, assetName), fixtureBody);
  const line =
    options.listAsset === false ? "" : `${options.checksum ?? sha256(fixtureBody)}  ${assetName}\n`;
  writeFileSync(path.join(releaseDir, "SHA256SUMS"), line);
}

type ShimResult = { code: number; stdout: string; stderr: string };

function runShim(
  args: string[],
  env: Record<string, string> = {},
  stdin: string = "",
  root: string = pluginRoot,
): ShimResult {
  const result = Bun.spawnSync(["sh", path.join(root, "bin/huntline"), ...args], {
    stdin: Buffer.from(stdin),
    env: {
      PATH: process.env["PATH"] ?? "",
      HOME: workDir,
      HUNTLINE_CACHE_DIR: cacheDir,
      HUNTLINE_RELEASE_BASE_URL: `file://${path.join(workDir, "releases")}`,
      ...env,
    },
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "huntline-shim-"));
  pluginRoot = path.join(workDir, "plugin");
  cacheDir = path.join(workDir, "cache");
  releaseDir = path.join(workDir, "releases", `v${version}`);
  mkdirSync(path.join(pluginRoot, "bin"), { recursive: true });
  mkdirSync(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  copyFileSync(shimSource, path.join(pluginRoot, "bin/huntline"));
  writeFileSync(
    path.join(pluginRoot, ".claude-plugin/plugin.json"),
    JSON.stringify({ name: "huntline", version }),
  );
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("bin/huntline shim", () => {
  test("downloads, verifies, caches and execs the binary", () => {
    publishRelease();
    const result = runShim(["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("fixture-binary --version\n");
    expect(existsSync(path.join(cacheDir, version, "huntline"))).toBe(true);
  });

  test("uses the cached binary without touching the network", () => {
    mkdirSync(path.join(cacheDir, version), { recursive: true });
    const cached = path.join(cacheDir, version, "huntline");
    writeFileSync(cached, '#!/bin/sh\necho "cached $*"\n');
    chmodSync(cached, 0o755);
    const result = runShim(["guard"], { HUNTLINE_RELEASE_BASE_URL: "file:///nonexistent" });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("cached guard\n");
  });

  test("a checksum mismatch refuses to run and leaves no cached binary", () => {
    publishRelease({ checksum: "0".repeat(64) });
    const result = runShim(["--version"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("checksum mismatch");
    expect(result.stdout).toBe("");
    expect(existsSync(path.join(cacheDir, version, "huntline"))).toBe(false);
    expect(readdirSync(path.join(cacheDir, version))).toEqual([]);
  });

  test("a missing checksum entry refuses to run", () => {
    publishRelease({ listAsset: false });
    const result = runShim(["--version"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no checksum listed");
    expect(existsSync(path.join(cacheDir, version, "huntline"))).toBe(false);
  });

  test("a missing release exits non-zero with a one-line reason", () => {
    const result = runShim(["--version"]);
    expect(result.code).not.toBe(0);
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect(result.stderr).toContain("not found");
  });

  test("HUNTLINE_PREFETCH caches the binary without running it", () => {
    publishRelease();
    const result = runShim([], { HUNTLINE_PREFETCH: "1" });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(existsSync(path.join(cacheDir, version, "huntline"))).toBe(true);
  });

  test("HUNTLINE_FROM_SOURCE=1 execs the source entrypoint through bun", () => {
    const sourceEntry = path.join(pluginRoot, "src/cli.ts");
    mkdirSync(path.dirname(sourceEntry), { recursive: true });
    writeFileSync(sourceEntry, 'console.log("from-source", process.argv.slice(2).join(" "));\n');
    const result = runShim(["init"], {
      HUNTLINE_FROM_SOURCE: "1",
      PATH: `${path.dirname(process.execPath)}:${process.env["PATH"] ?? ""}`,
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("from-source init\n");
  });

  test("defaults to the huntline release URL and asset name", () => {
    const fakeBin = path.join(workDir, "fake-bin");
    mkdirSync(fakeBin, { recursive: true });
    const curlLog = path.join(workDir, "curl.log");
    writeFileSync(
      path.join(fakeBin, "curl"),
      `#!/bin/sh\nfor arg in "$@"; do echo "$arg" >> "${curlLog}"; done\nexit 22\n`,
    );
    chmodSync(path.join(fakeBin, "curl"), 0o755);
    const result = Bun.spawnSync(["sh", path.join(pluginRoot, "bin/huntline"), "--version"], {
      env: {
        PATH: `${fakeBin}:${process.env["PATH"] ?? ""}`,
        HOME: workDir,
        HUNTLINE_CACHE_DIR: cacheDir,
      },
    });
    expect(result.exitCode).toBe(1);
    expect(Bun.file(curlLog).text()).resolves.toContain(
      `https://github.com/andryorelabs/huntline/releases/download/v${version}/${assetName}\n`,
    );
  });
});

describe("bin/huntline as the PreToolUse guard", () => {
  const unreachable = { HUNTLINE_RELEASE_BASE_URL: "file:///nonexistent/releases" };

  test("a download failure prints a deny and exits 0", () => {
    const result = runShim(["guard"], unreachable, clickPayload);
    expect(result.code).toBe(0);
    expect(denyReasonOf(result.stdout)).toContain("not found");
    expect(existsSync(path.join(cacheDir, version, "huntline"))).toBe(false);
  });

  test("guard --record keeps exiting 1 with an empty stdout", () => {
    const result = runShim(["guard", "--record"], unreachable, clickPayload);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("not found");
  });

  test("guard --self-test keeps exiting 1 with an empty stdout", () => {
    const result = runShim(["guard", "--self-test"], unreachable);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
  });

  test("a checksum mismatch prints a deny", () => {
    publishRelease({ checksum: "0".repeat(64) });
    const result = runShim(["guard"], {}, clickPayload);
    expect(result.code).toBe(0);
    expect(denyReasonOf(result.stdout)).toContain("checksum mismatch");
  });

  test("an unsupported platform prints a deny", () => {
    const fakePath = fakeCommand("uname", '#!/bin/sh\necho "Plan9"\n');
    const result = runShim(["guard"], { PATH: fakePath }, clickPayload);
    expect(result.code).toBe(0);
    expect(denyReasonOf(result.stdout)).toContain("unsupported platform Plan9");
  });

  test("a missing curl prints a deny", () => {
    const noCurlBin = path.join(workDir, "no-curl-bin");
    mkdirSync(noCurlBin, { recursive: true });
    const required = ["sh", "sed", "head", "uname", "mkdir", "dirname", "tr"];
    const optional = ["sha256sum", "shasum"];
    for (const tool of [...required, ...optional]) {
      const found = Bun.which(tool);
      if (found === null && required.includes(tool)) throw new Error(`${tool} not on PATH`);
      if (found !== null) symlinkSync(found, path.join(noCurlBin, tool));
    }
    const result = runShim(["guard"], { PATH: noCurlBin }, clickPayload);
    expect(result.code).toBe(0);
    expect(denyReasonOf(result.stdout)).toContain("curl is required");
  });

  test("a missing plugin.json version prints a deny with a JSON-safe reason", () => {
    const oddRoot = path.join(workDir, 'pl"ug\\in\tx\ny');
    mkdirSync(path.join(oddRoot, "bin"), { recursive: true });
    mkdirSync(path.join(oddRoot, ".claude-plugin"), { recursive: true });
    copyFileSync(shimSource, path.join(oddRoot, "bin/huntline"));
    writeFileSync(path.join(oddRoot, ".claude-plugin/plugin.json"), "{}");
    const result = runShim(["guard"], {}, clickPayload, oddRoot);
    expect(result.code).toBe(0);
    const reason = denyReasonOf(result.stdout);
    expect(reason).toContain("no version in");
    expect(reason).toContain('pl"ug\\in');
  });

  test("a missing plugin.json prints a deny, and other subcommands still exit 1", () => {
    rmSync(path.join(pluginRoot, ".claude-plugin/plugin.json"));
    const guard = runShim(["guard"], {}, clickPayload);
    expect(guard.code).toBe(0);
    expect(denyReasonOf(guard.stdout)).toContain("plugin.json");
    const other = runShim(["doctor"]);
    expect(other.code).toBe(1);
    expect(other.stdout).toBe("");
    expect(other.stderr).toContain("plugin.json");
  });

  test("a cached binary that cannot run prints a deny", () => {
    cacheBinary("#!/bin/sh\nexit 3\n");
    const result = runShim(["guard"], {}, clickPayload);
    expect(result.code).toBe(0);
    expect(denyReasonOf(result.stdout)).toContain("status 3");
  });

  test("passes the cached binary's stdin and output through", () => {
    cacheBinary("#!/bin/sh\ncat\n");
    const result = runShim(["guard"], {}, clickPayload);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(`${clickPayload}\n`);
  });

  test("passes an empty output through as no output", () => {
    cacheBinary("#!/bin/sh\nexit 0\n");
    const result = runShim(["guard"], {}, clickPayload);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("hooks/hooks.json", () => {
  const hooks: unknown = JSON.parse(readFileSync(hooksSource, "utf8"));
  const entriesFor = (event: string): Record<string, unknown>[] => {
    const byEvent = isObject(hooks) ? hooks["hooks"] : undefined;
    const entries: unknown = isObject(byEvent) ? byEvent[event] : undefined;
    return Array.isArray(entries) ? entries.filter(isObject) : [];
  };

  test("prefetches the binary at SessionStart", () => {
    const commands = entriesFor("SessionStart").flatMap((entry) => {
      const nested: unknown = entry["hooks"];
      return Array.isArray(nested) ? nested.filter(isObject) : [];
    });
    expect(
      commands.some(
        (hook) =>
          hook["type"] === "command" &&
          typeof hook["command"] === "string" &&
          hook["command"].includes("HUNTLINE_PREFETCH=1") &&
          hook["command"].includes("bin/huntline"),
      ),
    ).toBe(true);
  });

  test("the PreToolUse matcher skips dash and catches Gmail sends in any case", () => {
    const matchers = entriesFor("PreToolUse").map((entry) => String(entry["matcher"]));
    expect(matchers.length).toBeGreaterThan(0);
    const matches = (tool: string): boolean =>
      matchers.some((matcher) => new RegExp(`^(?:${matcher})$`).test(tool));
    expect(matches("mcp__x__delete_dashboard")).toBe(false);
    expect(matches("mcp__gmail__send_email")).toBe(true);
    expect(matches("mcp__Gmail__send_draft")).toBe(true);
    expect(matches("mcp__remote-devices__Claude_Browser__click")).toBe(true);
    expect(matches("mcp__claude_ai_Gmail__create_draft")).toBe(false);
  });
});
