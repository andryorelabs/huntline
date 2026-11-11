/**
 * Tools that hooks must reach through a package script, never directly.
 */
export const BANNED_HOOK_TOOLS = ["oxlint", "oxfmt", "tsc", "knip", "commitlint"] as const;

/**
 * One hook line that calls a banned tool directly.
 */
export interface HookViolation {
  readonly line: number;
  readonly tool: string;
}

const commandSeparator = /&&|\|\||[;|&]/;

/**
 * Finds commands of a husky hook that invoke a banned tool by name. A command is one segment of a
 * line between shell separators; a segment that starts with `bun run <script>` is allowed, as is
 * `lint-staged`.
 */
export function findDirectToolCalls(hookSource: string): HookViolation[] {
  const violations: HookViolation[] = [];
  hookSource.split("\n").forEach((line, index) => {
    if (/^\s*#/.test(line)) return;
    for (const command of line.split(commandSeparator)) {
      if (/^\s*bun\s+run\b/.test(command)) continue;
      for (const tool of BANNED_HOOK_TOOLS) {
        if (new RegExp(`(?<![\\w:-])${tool}(?![\\w-])`).test(command)) {
          violations.push({ line: index + 1, tool });
        }
      }
    }
  });
  return violations;
}
