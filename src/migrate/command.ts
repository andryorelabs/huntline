import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import type { Result } from "../core/types.ts";
import { importLegacy } from "./legacy.ts";
import { importLinear } from "./linear.ts";

const USAGE = "usage: migrate legacy <dir> | migrate linear --team <key> [--project <name>]";

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

function unwrap<T>(result: Result<T>): Envelope<T> {
  if (result.ok) return success(result.value);
  return failure(result.error.code, result.error.message);
}

function usage(message: string): Envelope<never> {
  return failure("usage", message, { recoverable: false });
}

export async function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [action, ...rest] = argv;
  if (action !== "legacy" && action !== "linear") return usage(USAGE);
  if (ctx.dataDir === null) {
    return failure("data-dir-not-found", "no data dir resolved; pass --data or set JOBSHIP_HOME");
  }
  if (action === "legacy") {
    const [dir] = rest;
    if (dir === undefined || dir.startsWith("--")) return usage(USAGE);
    return unwrap(await importLegacy(ctx, dir));
  }
  const team = flagValue(rest, "--team");
  if (team === undefined) return usage(USAGE);
  const project = flagValue(rest, "--project");
  return unwrap(await importLinear(ctx, project === undefined ? { team } : { team, project }));
}
