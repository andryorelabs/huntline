import { readFileSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { loadProfile } from "../core/data-dir.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage, isOneOf } from "../core/narrow.ts";
import { lintDraft } from "./lint.ts";
import { logOutreach } from "./log.ts";
import { CHANNELS, type Draft } from "./types.ts";

const USAGE =
  "usage: outreach lint --channel <linkedin|email> --recipient <name> --company <company> --file <draft> [--addressee <name>] [--draft-company <company>] | outreach log --channel <linkedin|email> --recipient <name> [--key <key>]";

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

function usage(message: string): Envelope<never> {
  return failure("usage", `${message}; ${USAGE}`, { recoverable: false });
}

function lint(argv: readonly string[], ctx: CommandContext): Envelope<unknown> {
  const channel = flagValue(argv, "--channel");
  const recipient = flagValue(argv, "--recipient");
  const company = flagValue(argv, "--company");
  const file = flagValue(argv, "--file");
  if (!isOneOf(CHANNELS, channel)) return usage("--channel must be linkedin or email");
  if (recipient === undefined || company === undefined || file === undefined) {
    return usage("--recipient, --company and --file are required");
  }
  let body: string;
  try {
    body = readFileSync(path.resolve(ctx.cwd, file), "utf8");
  } catch (error) {
    return failure("not-found", `cannot read ${file}: ${errorMessage(error)}`);
  }
  const addressee = flagValue(argv, "--addressee");
  const draftCompany = flagValue(argv, "--draft-company");
  const draft: Draft = {
    channel,
    body,
    ...(addressee === undefined ? {} : { addressee }),
    ...(draftCompany === undefined ? {} : { company: draftCompany }),
  };
  const findings = lintDraft(draft, { recipient: { name: recipient }, company });
  if (findings.length > 0) {
    return failure(
      "lint-failed",
      findings.map((finding) => `${finding.rule}: ${finding.message}`).join("; "),
    );
  }
  return success({ channel, findings: [] });
}

async function log(argv: readonly string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const channel = flagValue(argv, "--channel");
  const recipient = flagValue(argv, "--recipient");
  if (!isOneOf(CHANNELS, channel)) return usage("--channel must be linkedin or email");
  if (recipient === undefined) return usage("--recipient is required");
  if (ctx.dataDir === null) return failure("data-dir-not-found", "no data dir resolved");
  const profile = loadProfile(ctx.dataDir);
  if (!profile.ok) return failure(profile.error.code, profile.error.message);
  const key = flagValue(argv, "--key");
  const logged = await logOutreach(ctx.dataDir, profile.value, {
    channel,
    recipient,
    ...(key === undefined ? {} : { key }),
  });
  if (!logged.ok) return failure(logged.error.code, logged.error.message);
  return success({ channel, recipient });
}

export function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [subcommand, ...rest] = argv;
  if (subcommand === "lint") return Promise.resolve(lint(rest, ctx));
  if (subcommand === "log") return log(rest, ctx);
  return Promise.resolve(usage("unknown or missing subcommand"));
}
