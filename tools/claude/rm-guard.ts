import { realpathSync } from "node:fs";
import path from "node:path";

const SEPARATOR_CHARACTERS = new Set([";", "|", "&", "\n", "(", ")", "`"]);
const SHELL_COMMANDS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const PRINT_COMMANDS = new Set(["echo", "printf"]);
const DIRECTORY_COMMANDS = new Set(["cd", "pushd", "popd"]);
const SHELL_COMMAND_FLAG = /^-[A-Za-z]*c[A-Za-z]*$/;
const SUBSTITUTION = /\$\(|`/;
const UNRESOLVABLE_TARGET = /[$`~*?[{]/;
const LONG_RECURSIVE_FLAG = "--recursive";
const MENTIONS_RM = /(^|[^A-Za-z0-9_-])rm($|[^A-Za-z0-9_-])/;

interface LexedCommand {
  readonly segments: string[][];
  readonly heredocBodies: string[];
}

interface PendingHeredoc {
  readonly delimiter: string;
  readonly indented: boolean;
}

interface WalkState {
  readonly repoRoot: string;
  readonly cwd: string;
  changedDirectory: boolean;
}

/**
 * Splits a shell command into segments of words. Backslash-newline
 * continuations are joined first; quotes group words; separators, subshell
 * parentheses and backticks end a segment only outside quotes; redirections
 * and their targets are dropped; `#` comments are skipped; heredoc bodies are
 * collected separately so they can be inspected as scripts. Returns null when
 * the command cannot be parsed (an unterminated quote or heredoc delimiter).
 */
function lex(command: string): LexedCommand | null {
  const input = command.replaceAll("\\\n", "");
  const segments: string[][] = [];
  const heredocBodies: string[] = [];
  let pending: PendingHeredoc[] = [];
  let words: string[] = [];
  let current = "";
  let hasToken = false;
  let discardNext = false;

  const flush = (): void => {
    if (hasToken && !discardNext) {
      words.push(current);
    }
    if (hasToken) {
      discardNext = false;
    }
    current = "";
    hasToken = false;
  };
  const endSegment = (): void => {
    flush();
    discardNext = false;
    segments.push(words);
    words = [];
  };

  let index = 0;
  while (index < input.length) {
    const character = input.charAt(index);
    if (character === "'") {
      const end = input.indexOf("'", index + 1);
      if (end === -1) {
        return null;
      }
      current += input.slice(index + 1, end);
      hasToken = true;
      index = end + 1;
    } else if (character === '"') {
      index += 1;
      let closed = false;
      while (index < input.length) {
        const inner = input.charAt(index);
        if (inner === '"') {
          closed = true;
          index += 1;
          break;
        }
        const escaped = input.charAt(index + 1);
        if (inner === "\\" && '"\\$`'.includes(escaped) && escaped !== "") {
          current += escaped;
          index += 2;
        } else {
          current += inner;
          index += 1;
        }
      }
      if (!closed) {
        return null;
      }
      hasToken = true;
    } else if (character === "\\") {
      if (index + 1 >= input.length) {
        return null;
      }
      current += input.charAt(index + 1);
      hasToken = true;
      index += 2;
    } else if (character === "#" && !hasToken) {
      const end = input.indexOf("\n", index);
      index = end === -1 ? input.length : end;
    } else if (
      character === "<" &&
      input.startsWith("<<", index) &&
      input.charAt(index + 2) !== "<"
    ) {
      flush();
      index += 2;
      const indented = input.charAt(index) === "-";
      if (indented) {
        index += 1;
      }
      while (input.charAt(index) === " " || input.charAt(index) === "\t") {
        index += 1;
      }
      const parsed = readHeredocDelimiter(input, index);
      if (parsed === null) {
        return null;
      }
      pending.push({ delimiter: parsed.delimiter, indented });
      index = parsed.next;
    } else if (character === ">" || character === "<") {
      if (hasToken && /^\d+$/.test(current)) {
        current = "";
        hasToken = false;
      } else {
        flush();
      }
      while ("<>".includes(input.charAt(index)) && index < input.length) {
        index += 1;
      }
      if (input.charAt(index) === "&" || input.charAt(index) === "|") {
        index += 1;
      }
      discardNext = true;
    } else if (character === "&" && input.charAt(index + 1) === ">") {
      flush();
      index += 1;
    } else if (SEPARATOR_CHARACTERS.has(character)) {
      endSegment();
      index += 1;
      if (character === "\n" && pending.length > 0) {
        for (const heredoc of pending) {
          const body = readHeredocBody(input, index, heredoc);
          heredocBodies.push(body.text);
          index = body.next;
        }
        pending = [];
      }
    } else if (/\s/.test(character)) {
      flush();
      index += 1;
    } else {
      current += character;
      hasToken = true;
      index += 1;
    }
  }
  endSegment();
  return { segments, heredocBodies };
}

/**
 * Reads a heredoc delimiter word starting at `start`, removing quotes and
 * backslashes. Returns null on an unterminated quote.
 */
function readHeredocDelimiter(
  input: string,
  start: number,
): { delimiter: string; next: number } | null {
  let delimiter = "";
  let index = start;
  while (index < input.length) {
    const character = input.charAt(index);
    if (character === "'" || character === '"') {
      const end = input.indexOf(character, index + 1);
      if (end === -1) {
        return null;
      }
      delimiter += input.slice(index + 1, end);
      index = end + 1;
    } else if (character === "\\") {
      delimiter += input.charAt(index + 1);
      index += 2;
    } else if (
      /\s/.test(character) ||
      SEPARATOR_CHARACTERS.has(character) ||
      "<>".includes(character)
    ) {
      break;
    } else {
      delimiter += character;
      index += 1;
    }
  }
  return { delimiter, next: index };
}

/**
 * Reads heredoc body lines from `start` up to the delimiter line (or the end
 * of input) and returns the body text and the index after the delimiter line.
 */
function readHeredocBody(
  input: string,
  start: number,
  heredoc: PendingHeredoc,
): { text: string; next: number } {
  const lines: string[] = [];
  let index = start;
  while (index < input.length) {
    const lineEnd = input.indexOf("\n", index);
    const end = lineEnd === -1 ? input.length : lineEnd;
    const line = input.slice(index, end);
    index = lineEnd === -1 ? input.length : lineEnd + 1;
    const comparable = heredoc.indented ? line.replace(/^\t+/, "") : line;
    if (comparable === heredoc.delimiter) {
      break;
    }
    lines.push(line);
  }
  return { text: lines.join("\n"), next: index };
}

/**
 * Strips any directory prefix from a word (backslashes are already removed by
 * the lexer).
 */
function plainWord(token: string): string {
  return path.basename(token);
}

/**
 * Whether a long option is an abbreviation of `--recursive` (GNU accepts any
 * unambiguous prefix).
 */
function isLongRecursive(flag: string): boolean {
  return flag.length > 2 && LONG_RECURSIVE_FLAG.startsWith(flag);
}

/**
 * Whether the `rm` flags request recursion in any spelling (`-r`, `-R`,
 * `-rf`, `--recursive`, `--rec`).
 */
function isRecursive(flags: readonly string[]): boolean {
  return flags.some((flag) => isLongRecursive(flag) || /^-(?!-)[A-Za-z]*[rR][A-Za-z]*$/.test(flag));
}

/**
 * Resolves a path against a base directory component by component, following
 * every symlink that exists, so `..` is applied to the real directory. The
 * part of the path that does not exist yet is resolved lexically.
 */
function resolveReal(target: string, base: string): string {
  const absolute = path.isAbsolute(target) ? target : `${base}/${target}`;
  let current: string = path.sep;
  for (const component of absolute.split("/")) {
    if (component === "" || component === ".") {
      continue;
    }
    if (component === "..") {
      current = path.dirname(current);
      continue;
    }
    const next = path.join(current, component);
    try {
      current = realpathSync(next);
    } catch {
      current = next;
    }
  }
  return current;
}

/**
 * Whether the target resolves, through symlinks, strictly below the
 * repository root. The root itself, anything with an expansion or glob, and
 * anything that leaves the root are rejected.
 */
function isInsideRepository(target: string, state: WalkState): boolean {
  if (UNRESOLVABLE_TARGET.test(target)) {
    return false;
  }
  const root = resolveReal(state.repoRoot, path.sep);
  return resolveReal(target, state.cwd).startsWith(`${root}${path.sep}`);
}

/**
 * The script a shell word in the segment would run: the argument after any
 * `-…c` flag, or the joined arguments of `eval`. Undefined when there is none.
 */
function nestedScript(words: readonly string[]): string | undefined {
  const evalIndex = words.findIndex((word) => word === "eval");
  if (evalIndex !== -1) {
    return words.slice(evalIndex + 1).join(" ");
  }
  const shellIndex = words.findIndex((word) => SHELL_COMMANDS.has(plainWord(word)));
  if (shellIndex === -1) {
    return undefined;
  }
  const rest = words.slice(shellIndex + 1);
  const flagIndex = rest.findIndex((word) => SHELL_COMMAND_FLAG.test(word));
  return flagIndex === -1 ? undefined : rest[flagIndex + 1];
}

/**
 * Index of the first word that is `rm` (not a `git rm` subcommand), wherever
 * it sits in the segment, so wrappers and `find -exec` cannot hide it.
 */
function findRmIndex(words: readonly string[]): number {
  return words.findIndex(
    (word, index) => plainWord(word) === "rm" && plainWord(words[index - 1] ?? "") !== "git",
  );
}

function isSegmentAllowed(words: readonly string[], state: WalkState): boolean {
  if (words.some((word) => SUBSTITUTION.test(word) && !isCommandAllowed(word, state))) {
    return false;
  }
  const script = nestedScript(words);
  if (script !== undefined && !isCommandAllowed(script, state)) {
    return false;
  }
  if (PRINT_COMMANDS.has(plainWord(words[0] ?? ""))) {
    return true;
  }
  const rmIndex = findRmIndex(words);
  const beforeRm = rmIndex === -1 ? words : words.slice(0, rmIndex);
  if (beforeRm.some((word) => DIRECTORY_COMMANDS.has(word))) {
    state.changedDirectory = true;
  }
  if (rmIndex === -1) {
    return true;
  }
  const flags: string[] = [];
  const targets: string[] = [];
  let optionsEnded = false;
  for (const argument of words.slice(rmIndex + 1)) {
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
  return (
    !state.changedDirectory &&
    targets.length > 0 &&
    targets.every((target) => isInsideRepository(target, state))
  );
}

function isCommandAllowed(command: string, state: WalkState): boolean {
  const lexed = lex(command);
  if (lexed === null) {
    return !MENTIONS_RM.test(command);
  }
  for (const words of lexed.segments) {
    if (!isSegmentAllowed(words, state)) {
      return false;
    }
  }
  return lexed.heredocBodies.every((body) => isCommandAllowed(body, state));
}

/**
 * Decides a Bash command: "deny" when any segment is a recursive `rm` that
 * targets the repository root, a path outside it (also through symlinks), or
 * something that cannot be resolved statically (expansion, glob, no target,
 * an earlier `cd`). Relative targets resolve against `cwd`, which defaults to
 * the repository root. Nested scripts (`sh -c`, `eval`, substitutions) are
 * inspected, and a command that cannot be tokenized is denied. Non-recursive
 * `rm` and `git rm` are allowed.
 */
export function decideRm(
  command: string,
  repoRoot: string,
  cwd: string = repoRoot,
): "allow" | "deny" {
  const base = path.isAbsolute(cwd) ? cwd : path.resolve(repoRoot, cwd);
  const state: WalkState = { repoRoot, cwd: base, changedDirectory: false };
  return isCommandAllowed(command, state) ? "allow" : "deny";
}
