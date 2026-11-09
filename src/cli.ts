import { COMMANDS, resolveCommand, type CommandContext, type CommandModule } from "./core/commands.ts";
import { resolveDataDir } from "./core/data-dir.ts";
import { runDoctor } from "./core/doctor.ts";
import { exitCodeFor, failure, printEnvelope, success, type Envelope } from "./core/envelope.ts";
import { runInit } from "./core/init.ts";
import { errorMessage } from "./core/narrow.ts";
import { runSetup } from "./core/setup.ts";

declare const HUNTLINE_BUILD_VERSION: string | undefined;

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
};

export const MODULE_FILES: readonly string[] = Object.keys(MODULE_LOADERS);

function withoutDataFlag(argv: readonly string[]): string[] {
  const index = argv.indexOf("--data");
  if (index === -1) return [...argv];
  return [...argv.slice(0, index), ...argv.slice(index + 2)];
}

function buildVersion(): string {
  return typeof HUNTLINE_BUILD_VERSION === "string" ? HUNTLINE_BUILD_VERSION : "0.0.0-dev";
}

export async function dispatch(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
): Promise<Envelope<unknown>> {
  const [first] = argv;
  if (first === undefined || first === "--version") return success({ version: buildVersion() });
  const dataDir = resolveDataDir(argv, env, cwd);
  const ctx: CommandContext = { dataDir: dataDir.ok ? dataDir.value : null, env, cwd };
  if (first === "init") return runInit(argv.slice(1), cwd, env);
  if (first === "setup") return runSetup(env);
  if (first === "doctor") {
    const homeOverride = env["HUNTLINE_HOME"];
    const hasExplicitSource =
      argv.includes("--data") || (homeOverride !== undefined && homeOverride !== "");
    if (!dataDir.ok && hasExplicitSource) {
      return failure(dataDir.error.code, dataDir.error.message);
    }
    return runDoctor(ctx);
  }
  const command = resolveCommand(argv);
  if (command === null) {
    return failure("unknown-command", `unknown command "${argv.slice(0, 2).join(" ")}"`, {
      recoveryAction: "run huntline without arguments to see the version, or see the README",
    });
  }
  const load = MODULE_LOADERS[command.file];
  if (load === undefined) {
    return failure("internal", `no loader registered for ${command.file}`, { recoverable: false });
  }
  const sharedModule =
    Object.values(COMMANDS).filter((file) => file === command.file).length > 1;
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
  printEnvelope(envelope);
  process.exitCode = exitCodeFor(envelope);
}
