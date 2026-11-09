import { writeSync } from "node:fs";

import type { CommandContext } from "../core/commands.ts";
import type { Envelope } from "../core/envelope.ts";
import { decideGuard, type GuardDecision } from "./decide.ts";

export const MAX_STDIN_BYTES = 1024 * 1024;

type HookOutput = {
  readonly hookSpecificOutput: {
    readonly hookEventName: "PreToolUse";
    readonly permissionDecision: "allow" | "deny";
    readonly permissionDecisionReason: string;
  };
};

export function formatHookOutput(decision: GuardDecision): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision.decision,
      permissionDecisionReason:
        decision.decision === "deny" ? decision.reason : "no submit or send action detected",
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
    return decideGuard(parseJson(text));
  } catch (error) {
    return {
      decision: "deny",
      reason: `guard error: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

export async function run(_argv: string[], _ctx: CommandContext): Promise<Envelope<unknown>> {
  const decision = await guardDecisionFor(process.stdin);
  writeSync(1, `${JSON.stringify(formatHookOutput(decision))}\n`);
  process.exit(0);
}
