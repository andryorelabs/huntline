import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandContext } from "../core/commands.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import { EMAIL_CLASSES } from "../inbox/types.ts";
import { scoreClassifications, type LabelledEmail, type Prediction } from "./score.ts";

const DEFAULT_FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures",
  "inbox",
);

function usage(message: string): Envelope<never> {
  return failure("usage", message, { recoverable: false });
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function positional(argv: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (token.startsWith("--")) {
      index += 1;
      continue;
    }
    return token;
  }
  return undefined;
}

function toLabelled(value: unknown): LabelledEmail | null {
  if (!isObject(value)) return null;
  const { messageId, language, from, subject, body, label } = value;
  if (typeof messageId !== "string" || messageId === "") return null;
  if (language !== "en" && language !== "es") return null;
  if (typeof from !== "string" || typeof subject !== "string" || typeof body !== "string") return null;
  if (!isOneOf(EMAIL_CLASSES, label)) return null;
  return { messageId, language, from, subject, body, label };
}

function toPrediction(value: unknown): Prediction | null {
  if (!isObject(value)) return null;
  const { messageId, classification } = value;
  if (typeof messageId !== "string" || messageId === "") return null;
  if (!isOneOf(EMAIL_CLASSES, classification)) return null;
  return { messageId, classification };
}

function parseRows<Row>(text: string, convert: (value: unknown) => Row | null): Row[] | null {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) return null;
  const rows: Row[] = [];
  for (const entry of parsed) {
    const row = convert(entry);
    if (row === null) return null;
    rows.push(row);
  }
  return rows;
}

function loadLabels(directory: string): LabelledEmail[] | null {
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .toSorted();
  const labels: LabelledEmail[] = [];
  for (const name of files) {
    const rows = parseRows(readFileSync(path.join(directory, name), "utf8"), toLabelled);
    if (rows === null) return null;
    labels.push(...rows);
  }
  return labels;
}

export function run(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const file = positional(argv);
  if (file === undefined) return Promise.resolve(usage("inbox eval needs a classifications file path"));
  const labelsOverride = flagValue(argv, "--labels");
  const directory = labelsOverride === undefined ? DEFAULT_FIXTURES_DIR : path.resolve(ctx.cwd, labelsOverride);
  try {
    const labels = loadLabels(directory);
    if (labels === null || labels.length === 0) {
      return Promise.resolve(usage(`labelled fixtures in ${directory} are malformed or empty`));
    }
    const predictions = parseRows(readFileSync(path.resolve(ctx.cwd, file), "utf8"), toPrediction);
    if (predictions === null) {
      return Promise.resolve(usage("classifications must be a JSON array of {messageId, classification}"));
    }
    return Promise.resolve(success(scoreClassifications(labels, predictions)));
  } catch (error) {
    return Promise.resolve(usage(`could not read inputs: ${errorMessage(error)}`));
  }
}
