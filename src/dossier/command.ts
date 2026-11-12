import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage } from "../core/narrow.ts";
import { loadDossier } from "./dossier.ts";

function runCheck(ctx: CommandContext): Envelope<unknown> {
  if (ctx.dataDir === null) {
    return failure("data-dir-not-found", "no data directory found", { recoverable: false });
  }
  const loaded = loadDossier(ctx.dataDir);
  if (!loaded.ok) {
    return failure(loaded.error.code, loaded.error.message, {
      recoverable: true,
      recoveryAction: "fix the named Dossier file and run dossier check again",
    });
  }
  const sections = loaded.value.map(({ name, status, sources }) => ({ name, status, sources }));
  return success({ sections });
}

function dispatch(argv: string[], ctx: CommandContext): Envelope<unknown> {
  try {
    const [sub] = argv;
    if (sub !== "check") {
      return failure("usage", "usage: dossier check", { recoverable: false });
    }
    return runCheck(ctx);
  } catch (error) {
    return failure("internal", errorMessage(error), { recoverable: false });
  }
}

export function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  return Promise.resolve(dispatch(argv, ctx));
}
