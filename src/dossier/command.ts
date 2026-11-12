import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage } from "../core/narrow.ts";
import { applyDossierBatch, deriveBatch } from "./derive.ts";
import { loadDossier } from "./dossier.ts";
import { parseProposal } from "./proposal.ts";

type Failure = { readonly code: string; readonly message: string };

function resultFailure(error: Failure): Envelope<never> {
  return failure(error.code, error.message, { recoverable: true });
}

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

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

function positionals(argv: readonly string[]): string[] {
  const found: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token.startsWith("--")) index += 1;
    else found.push(token);
  }
  return found;
}

async function runDerive(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const file = flagValue(argv, "--file");
  if (file === undefined) return failure("usage", "usage: dossier derive --file <proposal.json>");
  const resolved = path.resolve(ctx.cwd, file);
  if (!existsSync(resolved)) {
    return failure("proposal-invalid", `no proposal file at ${resolved}`, { recoverable: true });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolved, "utf8"));
  } catch (error) {
    return failure("proposal-invalid", `${resolved} is not valid JSON: ${errorMessage(error)}`, {
      recoverable: true,
    });
  }
  const proposal = parseProposal(raw);
  if (!proposal.ok) return resultFailure(proposal.error);
  const derived = await deriveBatch(ctx, proposal.value);
  if (!derived.ok) return resultFailure(derived.error);
  const { batchPath, hash, items } = derived.value;
  return success({
    batchPath,
    hash,
    count: items.length,
    items: items.map(({ file: target, op, id }) => ({ file: target, op, id })),
  });
}

async function runApply(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [batch] = positionals(argv);
  if (batch === undefined) return failure("usage", "usage: dossier apply <batch>");
  const applied = await applyDossierBatch(ctx, batch);
  return applied.ok ? success(applied.value) : resultFailure(applied.error);
}

async function dispatch(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  try {
    const [sub, ...rest] = argv;
    if (sub === "check") return runCheck(ctx);
    if (sub === "derive") return await runDerive(rest, ctx);
    if (sub === "apply") return await runApply(rest, ctx);
    return failure("usage", "usage: dossier check|derive|apply", { recoverable: false });
  } catch (error) {
    return failure("internal", errorMessage(error), { recoverable: false });
  }
}

export function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  return dispatch(argv, ctx);
}
