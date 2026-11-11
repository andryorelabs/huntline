import path from "node:path";

const SEGMENT_SEPARATOR = /&&|\|\||[;|&\n()`]/;
const SHELL_COMMANDS = new Set(["sh", "bash", "zsh", "dash"]);
const PRINT_COMMANDS = new Set(["echo", "printf"]);
const UNRESOLVABLE_TARGET = /[$`~*?[{]/;

/**
 * Splits one shell segment into words, honouring single and double quotes.
 * Quote characters are dropped; no expansion is performed.
 */
function tokenize(segment: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let hasToken = false;
  let quote: string | null = null;
  for (const character of segment) {
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
      hasToken = true;
    } else if (/\s/.test(character)) {
      if (hasToken) {
        tokens.push(current);
        current = "";
        hasToken = false;
      }
    } else {
      current += character;
      hasToken = true;
    }
  }
  if (hasToken) {
    tokens.push(current);
  }
  return tokens;
}

/**
 * Strips a leading backslash (`\rm` skips aliases) and any directory prefix
 * from a word.
 */
function plainWord(token: string): string {
  return path.basename(token.replace(/^\\+/, ""));
}

/**
 * Whether the `rm` flags request recursion in any spelling (`-r`, `-R`,
 * `-rf`, `--recursive`).
 */
function isRecursive(flags: readonly string[]): boolean {
  return flags.some((flag) => flag === "--recursive" || /^-[A-Za-z]*[rR][A-Za-z]*$/.test(flag));
}

/**
 * Whether the target resolves strictly below the repository root. The root
 * itself, anything with an expansion or glob, and anything that normalises
 * out of the root are rejected.
 */
function isInsideRepository(target: string, repoRoot: string): boolean {
  if (UNRESOLVABLE_TARGET.test(target)) {
    return false;
  }
  const root = path.resolve(repoRoot);
  return path.resolve(root, target).startsWith(`${root}${path.sep}`);
}

/**
 * The script of the first `sh -c`-style invocation in the segment, or
 * undefined when there is none.
 */
function shellScript(tokens: readonly string[]): string | undefined {
  const shellIndex = tokens.findIndex((token) => SHELL_COMMANDS.has(plainWord(token)));
  if (shellIndex === -1) {
    return undefined;
  }
  const rest = tokens.slice(shellIndex + 1);
  const scriptIndex = rest.indexOf("-c") + 1;
  return scriptIndex > 0 ? rest[scriptIndex] : undefined;
}

/**
 * Index of the first word that is `rm` (not a `git rm` subcommand), wherever
 * it sits in the segment, so wrappers and `find -exec` cannot hide it.
 */
function findRmIndex(tokens: readonly string[]): number {
  return tokens.findIndex(
    (token, index) => plainWord(token) === "rm" && plainWord(tokens[index - 1] ?? "") !== "git",
  );
}

function isSegmentAllowed(segment: string, repoRoot: string): boolean {
  const tokens = tokenize(segment);
  const script = shellScript(tokens);
  if (script !== undefined && decideRm(script, repoRoot) === "deny") {
    return false;
  }
  const rmIndex = findRmIndex(tokens);
  if (rmIndex === -1 || PRINT_COMMANDS.has(plainWord(tokens[0] ?? ""))) {
    return true;
  }
  const flags: string[] = [];
  const targets: string[] = [];
  let optionsEnded = false;
  for (const argument of tokens.slice(rmIndex + 1)) {
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
    } else if (!optionsEnded && argument.startsWith("-")) {
      flags.push(argument);
    } else if (argument !== "}") {
      targets.push(argument);
    }
  }
  if (!isRecursive(flags)) {
    return true;
  }
  return targets.length > 0 && targets.every((target) => isInsideRepository(target, repoRoot));
}

/**
 * Decides a Bash command: "deny" when any segment is a recursive `rm` that
 * targets the repository root, a path outside it, or something that cannot be
 * resolved statically (expansion, glob, no target). Relative targets resolve
 * against the repository root. Non-recursive `rm` and `git rm` are allowed.
 */
export function decideRm(command: string, repoRoot: string): "allow" | "deny" {
  return command.split(SEGMENT_SEPARATOR).every((segment) => isSegmentAllowed(segment, repoRoot))
    ? "allow"
    : "deny";
}
