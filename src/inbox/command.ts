import { readFileSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import { applyBatch, proposeBatch } from "./batch.ts";
import { EMAIL_CLASSES, type ClassifiedEmail } from "./types.ts";

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function positionals(argv: readonly string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (token.startsWith("--")) {
      index += 1;
      continue;
    }
    values.push(token);
  }
  return values;
}

function usage(message: string): Envelope<never> {
  return failure("usage", message, { recoverable: false });
}

function toEmail(value: unknown): ClassifiedEmail | null {
  if (!isObject(value)) return null;
  const { messageId, threadId, from, subject, classification } = value;
  if (typeof messageId !== "string" || messageId === "") return null;
  if (typeof threadId !== "string" || typeof from !== "string" || typeof subject !== "string") return null;
  if (!isOneOf(EMAIL_CLASSES, classification)) return null;
  return { messageId, threadId, from, subject, classification };
}

function readEmails(file: string, cwd: string): ClassifiedEmail[] | null {
  const parsed: unknown = JSON.parse(readFileSync(path.resolve(cwd, file), "utf8"));
  if (!Array.isArray(parsed)) return null;
  const emails: ClassifiedEmail[] = [];
  for (const row of parsed) {
    const email = toEmail(row);
    if (email === null) return null;
    emails.push(email);
  }
  return emails;
}

async function runPropose(argv: readonly string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const file = flagValue(argv, "--emails");
  if (file === undefined) return usage("inbox propose needs --emails <classified.json>");
  const emails = readEmails(file, ctx.cwd);
  if (emails === null) {
    return usage("emails must be a JSON array of {messageId, threadId, from, subject, classification}");
  }
  const proposed = await proposeBatch(ctx, emails);
  if (!proposed.ok) return failure(proposed.error.code, proposed.error.message);
  const { batchPath, hash, items } = proposed.value;
  return success({
    batchPath,
    hash,
    items,
    confirmed: items.filter((item) => item.confirmed).length,
    unconfirmed: items.filter((item) => !item.confirmed).length,
  });
}

async function runApply(argv: readonly string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [batchPath] = positionals(argv);
  if (batchPath === undefined) return usage("inbox apply needs a batch file path");
  const applied = await applyBatch(ctx, batchPath);
  if (!applied.ok) {
    return failure(applied.error.code, applied.error.message, {
      recoverable: true,
      recoveryAction: "run inbox propose again and review the new batch",
    });
  }
  return success(applied.value);
}

export async function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  try {
    const [sub, ...rest] = argv;
    if (sub !== "propose" && sub !== "apply") return usage("usage: inbox propose|apply");
    if (ctx.dataDir === null) {
      return failure("data-dir-not-found", "no data directory found", { recoverable: false });
    }
    return sub === "propose" ? await runPropose(rest, ctx) : await runApply(rest, ctx);
  } catch (error) {
    return failure("internal", errorMessage(error), { recoverable: false });
  }
}
