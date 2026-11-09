import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { buildCv, outputPaths, readCvText, systemRunner, type TypstRunner } from "./build.ts";
import { loadFactBank, loadNeverClaim } from "./facts.ts";
import { lintCv } from "./lint.ts";
import { requirementCoverage } from "./select.ts";

type Parsed = {
  readonly positional: string[];
  readonly flags: Map<string, string[]>;
};

function parseArgs(argv: readonly string[]): Parsed | string {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--data") {
      index += 1;
      continue;
    }
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) return `${token} needs a value`;
    flags.set(token, [...(flags.get(token) ?? []), value]);
    index += 1;
  }
  return { positional, flags };
}

function single(parsed: Parsed, flag: string): string | undefined {
  return parsed.flags.get(flag)?.at(-1);
}

function splitList(values: string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  return values.flatMap((value) => value.split(",")).map((item) => item.trim()).filter((item) => item !== "");
}

function usage(message: string): Envelope<never> {
  return failure("usage", message);
}

function resultFailure(error: { code: string; message: string }): Envelope<never> {
  return failure(error.code, error.message);
}

export async function runWith(
  argv: string[],
  ctx: CommandContext,
  runner: TypstRunner,
): Promise<Envelope<unknown>> {
  const [subcommand, ...rest] = argv;
  if (subcommand !== "build" && subcommand !== "lint" && subcommand !== "coverage") {
    return usage("usage: cv build|lint|coverage");
  }
  if (ctx.dataDir === null) return failure("data-dir-not-found", "no data dir resolved");
  const parsed = parseArgs(rest);
  if (typeof parsed === "string") return usage(parsed);
  const dir = ctx.dataDir;

  if (subcommand === "build") {
    const tags = splitList(parsed.flags.get("--tag"));
    const requirements = splitList(parsed.flags.get("--requirement"));
    const name = single(parsed, "--variant");
    const template = single(parsed, "--template");
    const built = await buildCv(dir, {
      ...(name === undefined ? {} : { name }),
      ...(tags === undefined ? {} : { tags }),
      ...(requirements === undefined ? {} : { requirements }),
      ...(template === undefined ? {} : { template: path.resolve(ctx.cwd, template) }),
      runner,
    });
    return built.ok ? success(built.value) : resultFailure(built.error);
  }

  if (subcommand === "lint") {
    const file = single(parsed, "--file");
    const variant = single(parsed, "--variant") ?? "cv";
    const textPath = file === undefined ? outputPaths(dir, variant).text : path.resolve(ctx.cwd, file);
    const text = readCvText(textPath);
    if (!text.ok) return resultFailure(text.error);
    const facts = loadFactBank(dir);
    if (!facts.ok) return resultFailure(facts.error);
    const neverClaim = loadNeverClaim(dir);
    if (!neverClaim.ok) return resultFailure(neverClaim.error);
    const findings = lintCv(text.value, { facts: facts.value, neverClaim: neverClaim.value });
    if (findings.length === 0) return success({ file: textPath, findings });
    const detail = findings.map((finding) => finding.message).join("; ");
    return failure("lint-failed", `${findings.length} finding(s): ${detail}`);
  }

  const key = parsed.positional[0];
  if (key === undefined) return usage("usage: cv coverage <key> --requirement <text>...");
  const requirements = splitList(parsed.flags.get("--requirement"));
  if (requirements === undefined || requirements.length === 0) {
    return usage("cv coverage needs at least one --requirement");
  }
  const facts = loadFactBank(dir);
  if (!facts.ok) return resultFailure(facts.error);
  return success({ key, ...requirementCoverage(requirements, facts.value) });
}

export function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  return runWith(argv, ctx, systemRunner);
}
