import type { Envelope } from "./envelope.ts";
import type { DataDir } from "./types.ts";

export type CommandContext = {
  readonly dataDir: DataDir | null;
  readonly env: Record<string, string | undefined>;
  readonly cwd: string;
};

export type CommandModule = {
  run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>>;
};

export const COMMANDS: Record<string, string> = {
  sweep: "src/sweep/command.ts",
  ingest: "src/sweep/command.ts",
  score: "src/sweep/command.ts",
  ledger: "src/ledger/command.ts",
  events: "src/ledger/command.ts",
  status: "src/ledger/command.ts",
  company: "src/sources/command.ts",
  cv: "src/cv/command.ts",
  apply: "src/apply/command.ts",
  needs: "src/apply/command.ts",
  inbox: "src/inbox/command.ts",
  "inbox eval": "src/inbox-eval/command.ts",
  outreach: "src/outreach/command.ts",
  interview: "src/interview/command.ts",
  migrate: "src/migrate/command.ts",
  guard: "src/guard/command.ts",
};

export function resolveCommand(
  argv: readonly string[],
): { path: string; file: string; rest: string[] } | null {
  const [first, second] = argv;
  if (first === undefined) return null;
  if (second !== undefined) {
    const twoWord = `${first} ${second}`;
    const file = COMMANDS[twoWord];
    if (file !== undefined) return { path: twoWord, file, rest: argv.slice(2) };
  }
  const file = COMMANDS[first];
  if (file === undefined) return null;
  return { path: first, file, rest: argv.slice(1) };
}
