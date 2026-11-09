import type { CommandContext } from "../core/commands.ts";
import { failure, type Envelope } from "../core/envelope.ts";

export function run(argv: string[], _ctx: CommandContext): Promise<Envelope<unknown>> {
  const invocation = ["migrate", ...argv].join(" ");
  return Promise.resolve(
    failure("not-implemented", `${invocation} is not implemented yet`, { recoverable: false }),
  );
}
