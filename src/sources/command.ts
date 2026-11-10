import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { addCompany, readCompanies } from "./companies.ts";
import { detectAts } from "./detect.ts";

const USAGE = "usage: huntline company add <careers-url> | huntline company list";

function dataDirMissing(): Envelope<never> {
  return failure("data-dir-not-found", "company commands need a data directory", {
    recoveryAction:
      "pass --data <dir>, set HUNTLINE_HOME, or run from a directory containing huntline.json",
  });
}

async function runAdd(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [url] = argv;
  if (url === undefined || argv.length !== 1) return failure("usage", USAGE);
  if (ctx.dataDir === null) return dataDirMissing();
  const detected = detectAts(url);
  if (detected === null) {
    return failure("unsupported-careers-url", `could not detect a supported ATS in ${url}`, {
      recoveryAction: "use a Greenhouse, Lever, Ashby, Workable or SmartRecruiters careers URL",
    });
  }
  const outcome = await addCompany(ctx.dataDir, detected);
  if (!outcome.ok) return failure(outcome.error.code, outcome.error.message);
  return success(outcome.value);
}

function runList(argv: string[], ctx: CommandContext): Envelope<unknown> {
  if (argv.length !== 0) return failure("usage", USAGE);
  if (ctx.dataDir === null) return dataDirMissing();
  const companies = readCompanies(ctx.dataDir);
  if (!companies.ok) return failure(companies.error.code, companies.error.message);
  return success({ companies: companies.value });
}

export function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [subcommand, ...rest] = argv;
  if (subcommand === "add") return runAdd(rest, ctx);
  if (subcommand === "list") return Promise.resolve(runList(rest, ctx));
  return Promise.resolve(failure("usage", USAGE));
}
