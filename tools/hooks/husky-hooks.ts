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

/**
 * Finds lines of a husky hook that invoke a banned tool by name. Calls through `bun run <script>`
 * are allowed, as is `lint-staged`.
 */
export function findDirectToolCalls(hookSource: string): HookViolation[] {
  const violations: HookViolation[] = [];
  hookSource.split("\n").forEach((line, index) => {
    if (/^\s*#/.test(line) || /\bbun\s+run\b/.test(line)) return;
    for (const tool of BANNED_HOOK_TOOLS) {
      if (new RegExp(`(?<![\\w:-])${tool}(?![\\w-])`).test(line)) {
        violations.push({ line: index + 1, tool });
      }
    }
  });
  return violations;
}
