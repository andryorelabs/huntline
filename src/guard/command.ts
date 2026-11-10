import { writeSync } from "node:fs";

import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { isObject } from "../core/narrow.ts";
import { decideGuard, parseMcpToolName, snapshotScope, type GuardDecision } from "./decide.ts";
import { runGuardSelfTest, SELF_TEST_HOOKS, type SelfTestResult } from "./self-test.ts";
import { lookupLabel, parseSnapshotLabels, recordSnapshot } from "./snapshot.ts";

export const MAX_STDIN_BYTES = 1024 * 1024;

type HookOutput = {
  readonly hookSpecificOutput: {
    readonly hookEventName: "PreToolUse";
    readonly permissionDecision: "deny";
    readonly permissionDecisionReason: string;
  };
};

/**
 * Turns a Guard decision into PreToolUse hook output. The Guard never grants
 * permission: no objection returns `null`, meaning print nothing and leave
 * Claude Code's normal permission flow in charge.
 */
export function formatHookOutput(decision: GuardDecision): HookOutput | null {
  if (decision.decision !== "deny") return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: decision.reason,
    },
  };
}

export async function readBoundedStdin(
  stream: AsyncIterable<unknown>,
  maxBytes: number,
): Promise<string | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    if (!(buffer instanceof Uint8Array)) return null;
    total += buffer.byteLength;
    if (total > maxBytes) return null;
    chunks.push(Buffer.from(buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function guardDecisionFor(stream: AsyncIterable<unknown>): Promise<GuardDecision> {
  try {
    const text = await readBoundedStdin(stream, MAX_STDIN_BYTES);
    if (text === null) {
      return { decision: "deny", reason: "hook payload is oversized or unreadable" };
    }
    return decideGuard(parseJson(text), lookupLabel);
  } catch (error) {
    return {
      decision: "deny",
      reason: `guard error: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

export function recordFromPayload(text: string): void {
  const payload = parseJson(text);
  if (!isObject(payload)) return;
  const record = payload;
  const sessionId = record["session_id"];
  if (typeof sessionId !== "string" || sessionId === "") return;
  const toolName = record["tool_name"];
  if (typeof toolName !== "string") return;
  const parsed = parseMcpToolName(toolName);
  if (parsed === null || parsed === "not-mcp") return;
  recordSnapshot(
    snapshotScope(sessionId, parsed.server),
    parseSnapshotLabels(record["tool_response"]),
  );
}

async function runRecorder(): Promise<never> {
  const text = await readBoundedStdin(process.stdin, MAX_STDIN_BYTES);
  if (text !== null) recordFromPayload(text);
  writeSync(1, "{}\n");
  process.exit(0);
}

export function selfTestEnvelope(result: SelfTestResult): Envelope<unknown> {
  if (result.pass) return success({ cases: result.cases });
  const lines = result.cases.map(
    (entry) =>
      `${entry.pass ? "ok" : "FAIL"} ${entry.name}: expected ${entry.expected}, actual ${entry.actual}, matcher ${entry.matcherCovers ? "covers" : "misses"} ${entry.tool}`,
  );
  const failed = result.cases.filter((entry) => !entry.pass).map((entry) => entry.name);
  return failure(
    "guard-self-test-failed",
    `failing cases: ${failed.join("; ")}\n${lines.join("\n")}`,
    {
      recoveryAction: "do not use the Guard until decideGuard and hooks/hooks.json agree again",
    },
  );
}

export async function run(argv: string[], _ctx: CommandContext): Promise<Envelope<unknown>> {
  if (argv.includes("--self-test")) return selfTestEnvelope(runGuardSelfTest(SELF_TEST_HOOKS));
  if (argv.includes("--record")) return runRecorder();
  const output = formatHookOutput(await guardDecisionFor(process.stdin));
  if (output !== null) writeSync(1, `${JSON.stringify(output)}\n`);
  return process.exit(0);
}
