import {
  COMMANDS,
  findUnknownFlag,
  resolveCommand,
  type CommandContext,
  type CommandModule,
} from "./core/commands.ts";
import { resolveDataDir } from "./core/data-dir.ts";
import { readSetting } from "./core/env.ts";
import { runDoctor } from "./core/doctor.ts";
import { exitCodeFor, failure, printEnvelope, success, type Envelope } from "./core/envelope.ts";
import { writeBannerForArgs } from "./core/banner.ts";
import { runInit } from "./core/init.ts";
import { errorMessage } from "./core/narrow.ts";
import { runSetup } from "./core/setup.ts";

declare const JOBSHIP_BUILD_VERSION: string | undefined;

const MODULE_LOADERS: Readonly<Record<string, () => Promise<CommandModule>>> = {
  "src/sweep/command.ts": () => import("./sweep/command.ts"),
  "src/ledger/command.ts": () => import("./ledger/command.ts"),
  "src/sources/command.ts": () => import("./sources/command.ts"),
  "src/cv/command.ts": () => import("./cv/command.ts"),
  "src/apply/command.ts": () => import("./apply/command.ts"),
  "src/inbox/command.ts": () => import("./inbox/command.ts"),
  "src/inbox-eval/command.ts": () => import("./inbox-eval/command.ts"),
  "src/outreach/command.ts": () => import("./outreach/command.ts"),
  "src/interview/command.ts": () => import("./interview/command.ts"),
  "src/migrate/command.ts": () => import("./migrate/command.ts"),
  "src/guard/command.ts": () => import("./guard/command.ts"),
  "src/dossier/command.ts": () => import("./dossier/command.ts"),
};

export const MODULE_FILES: readonly string[] = Object.keys(MODULE_LOADERS);

function withoutDataFlag(argv: readonly string[]): string[] {
  const index = argv.indexOf("--data");
  if (index === -1) return [...argv];
  return [...argv.slice(0, index), ...argv.slice(index + 2)];
}

function buildVersion(): string {
  if (typeof JOBSHIP_BUILD_VERSION === "string") return JOBSHIP_BUILD_VERSION;
  return "0.0.0-dev";
}

const USAGE_LINES: readonly string[] = [
  "usage: jobship <command> [flags]",
  "global flags: --data <dir>, --version, --help",
];

function usageEnvelope(): Envelope<unknown> {
  const commands = ["init", "setup", "doctor", ...Object.keys(COMMANDS)];
  return success({ usage: USAGE_LINES.join("\n"), commands });
}

function needsDataDir(path: string, rest: readonly string[]): boolean {
  if (path === "guard" || path === "inbox eval") return false;
  if (path === "apply") return rest[0] !== "verify";
  if (path === "outreach") return rest[0] !== "lint";
  return true;
}

export async function dispatch(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
): Promise<Envelope<unknown>> {
  const [first] = argv;
  if (first === "--version") return success({ version: buildVersion() });
  if (first === undefined || first === "--help" || first === "help") return usageEnvelope();
  const dataDir = resolveDataDir(argv, env, cwd);
  const ctx: CommandContext = { dataDir: dataDir.ok ? dataDir.value : null, env, cwd };
  if (first === "init" || first === "setup" || first === "doctor") {
    const unknownEntryFlag = findUnknownFlag(first, withoutDataFlag(argv.slice(1)));
    if (unknownEntryFlag !== null) {
      return failure("usage", `unknown flag ${unknownEntryFlag} for "${first}"`, {
        recoverable: false,
      });
    }
  }
  if (first === "init") return runInit(argv.slice(1), cwd, env);
  if (first === "setup") return runSetup(env);
  if (first === "doctor") {
    const hasExplicitSource = argv.includes("--data") || readSetting(env, "HOME") !== undefined;
    if (!dataDir.ok && hasExplicitSource) {
      return failure(dataDir.error.code, dataDir.error.message);
    }
    return await runDoctor(ctx);
  }
  const command = resolveCommand(withoutDataFlag(argv));
  if (command === null) {
    return failure("unknown-command", `unknown command "${argv.slice(0, 2).join(" ")}"`, {
      recoveryAction: "run jobship without arguments to see the version, or see the README",
    });
  }
  const unknownFlag = findUnknownFlag(command.path, command.rest);
  if (unknownFlag !== null) {
    return failure("usage", `unknown flag ${unknownFlag} for "${command.path}"`, {
      recoverable: false,
    });
  }
  if (!dataDir.ok && needsDataDir(command.path, command.rest)) {
    return failure(dataDir.error.code, dataDir.error.message);
  }
  const load = MODULE_LOADERS[command.file];
  if (load === undefined) {
    return failure("internal", `no loader registered for ${command.file}`, { recoverable: false });
  }
  const sharedModule = Object.values(COMMANDS).filter((file) => file === command.file).length > 1;
  const moduleArgv = sharedModule ? [command.path, ...command.rest] : command.rest;
  return (await load()).run(withoutDataFlag(moduleArgv), ctx);
}

if (import.meta.main) {
  let envelope: Envelope<unknown>;
  try {
    envelope = await dispatch(process.argv.slice(2), process.env, process.cwd());
  } catch (error) {
    envelope = failure("internal", errorMessage(error), { recoverable: false });
  }
  writeBannerForArgs(process.argv.slice(2), process.stderr, process.env);
  printEnvelope(envelope);
  process.exitCode = exitCodeFor(envelope);
}
