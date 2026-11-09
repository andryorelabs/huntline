import { existsSync, readFileSync } from "node:fs";
import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { loadFactBank } from "../cv/facts.ts";
import { isSafeKey, packPath, scaffoldPrepPack, validatePrepPack } from "./pack.ts";

const USAGE = "usage: interview pack <key> | interview check <key>";

function runSync(argv: string[], ctx: CommandContext): Envelope<unknown> {
  const [subcommand, key] = argv;
  if (subcommand !== "pack" && subcommand !== "check") return failure("usage", USAGE);
  if (key === undefined || key.startsWith("--")) return failure("usage", USAGE);
  if (!isSafeKey(key)) return failure("usage", `unsafe key: ${key}`);
  if (ctx.dataDir === null) return failure("data-dir-not-found", "no data dir resolved");
  const dir = ctx.dataDir;
  const bank = loadFactBank(dir);
  if (!bank.ok) return failure(bank.error.code, bank.error.message);

  if (subcommand === "pack") {
    const created = scaffoldPrepPack(dir, key, bank.value);
    if (!created.ok) return failure(created.error.code, created.error.message);
    return success({ key, path: created.value });
  }

  const target = packPath(dir, key);
  if (!existsSync(target)) {
    return failure("not-found", `no Prep pack for ${key}`, { recoveryAction: `run: interview pack ${key}` });
  }
  const findings = validatePrepPack(readFileSync(target, "utf8"), bank.value);
  if (findings.length > 0) {
    return failure("pack-invalid", findings.map((finding) => `line ${finding.line}: ${finding.message}`).join("; "));
  }
  return success({ key, path: target, findings: [] });
}

export function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  return Promise.resolve(runSync(argv, ctx));
}
