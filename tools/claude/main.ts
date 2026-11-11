import { decideRm } from "./rm-guard.ts";

const DENY_REASON =
  "recursive rm outside the repository, or on the repository root, is blocked; delete specific paths inside the repository or ask the user";

/**
 * Builds the PreToolUse deny decision the hook contract expects on stdout.
 */
function denyOutput(reason: string): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
}

/**
 * Extracts the Bash command from the hook payload, or undefined when the
 * payload has no string command.
 */
function readCommand(payload: object): string | undefined {
  const toolInput = (payload as { tool_input?: unknown }).tool_input;
  if (typeof toolInput !== "object" || toolInput === null) {
    return undefined;
  }
  const command = (toolInput as { command?: unknown }).command;
  return typeof command === "string" ? command : undefined;
}

/**
 * Returns the hook stdout for a raw stdin payload: a deny decision when the
 * input cannot be parsed or the command fails the rm guard, or null to stay
 * silent. Fails closed on malformed JSON and on non-object payloads.
 */
function decide(stdin: string, repoRoot: string): string | null {
  let payload: unknown;
  try {
    payload = JSON.parse(stdin);
  } catch {
    return denyOutput("hook input is not valid JSON; denying by default");
  }
  if (typeof payload !== "object" || payload === null) {
    return denyOutput("hook input is not an object; denying by default");
  }
  const command = readCommand(payload);
  if (command === undefined) {
    return null;
  }
  const cwd = (payload as { cwd?: unknown }).cwd;
  const decision = decideRm(command, repoRoot, typeof cwd === "string" ? cwd : repoRoot);
  return decision === "deny" ? denyOutput(DENY_REASON) : null;
}

const output = decide(await Bun.stdin.text(), process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd());
if (output !== null) {
  process.stdout.write(`${output}\n`);
}
