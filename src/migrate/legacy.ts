import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import type { Posting } from "../core/types.ts";
import { withImporter, type Importer } from "./importer.ts";
import { mapState, mapVerdict } from "./states.ts";
import { hasColumns, parseTables, type TableRow } from "./table.ts";
import type { ImportResult } from "./types.ts";

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

type FileContext = { readonly importer: Importer; readonly file: string; readonly fallbackDate: string };

function isDirectory(candidate: string): boolean {
  return existsSync(candidate) && statSync(candidate).isDirectory();
}

function markdownFiles(directory: string): string[] {
  if (!isDirectory(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .toSorted()
    .map((name) => path.join(directory, name));
}

function subdirectories(directory: string): string[] {
  if (!isDirectory(directory)) return [];
  return readdirSync(directory)
    .toSorted()
    .map((name) => path.join(directory, name))
    .filter(isDirectory);
}

function toPosting(row: TableRow, date: string): Posting {
  const channel = (row["channel"] ?? "").toLowerCase();
  return {
    id: "",
    source: channel === "" ? "legacy" : channel,
    url: row["url"] ?? "",
    company: row["company"] ?? "",
    title: row["role"] ?? "",
    ...(date === "" ? {} : { postedAt: date }),
  };
}

function rowDate(row: TableRow, fallback: string): string {
  return DATE_PATTERN.exec(row["date"] ?? "")?.[0] ?? fallback;
}

function isRoleRow(row: TableRow): boolean {
  return (row["company"] ?? "") !== "" && (row["role"] ?? "") !== "";
}

function describe(kind: string, ctx: FileContext, date: string, row: TableRow, extra: string[]): string {
  const notes = row["notes"] ?? "";
  return [
    `legacy ${kind} ${ctx.file}`,
    date === "" ? "" : `date ${date}`,
    ...extra,
    notes === "" ? "" : `notes ${notes}`,
  ]
    .filter((part) => part !== "")
    .join("; ");
}

function importCoverage(rows: readonly TableRow[], ctx: FileContext): void {
  for (const row of rows) {
    const company = row["company"] ?? "";
    if (company === "") continue;
    const date = rowDate(row, ctx.fallbackDate);
    const result = row["state"] ?? row["verdict"] ?? "";
    ctx.importer.note(
      `company:${company.toLowerCase()}`,
      describe("coverage", ctx, date, row, [`company ${company}`, result === "" ? "" : `result ${result}`]),
    );
  }
}

function fileContext(file: string, importer: Importer, fallbackDate?: string): FileContext {
  const name = path.basename(file);
  return { importer, file: name, fallbackDate: fallbackDate ?? DATE_PATTERN.exec(name)?.[0] ?? "" };
}

function importSweepFile(file: string, fallbackDate: string, importer: Importer): void {
  const ctx = fileContext(file, importer, fallbackDate);
  for (const rows of parseTables(readFileSync(file, "utf8"))) {
    if (hasColumns(rows, ["company", "role"])) {
      for (const row of rows.filter(isRoleRow)) {
        const date = rowDate(row, fallbackDate);
        const key = importer.lead(toPosting(row, date));
        importer.note(key, describe("sweep", ctx, date, row, []));
      }
    } else if (hasColumns(rows, ["company"])) {
      importCoverage(rows, ctx);
    }
  }
}

function importReviewRow(row: TableRow, ctx: FileContext): void {
  const { importer } = ctx;
  const date = rowDate(row, ctx.fallbackDate);
  const key = importer.lead(toPosting(row, date));
  const verdictText = row["verdict"] ?? "";
  const scoreText = row["score"] ?? "";
  const score = Number.parseFloat(scoreText);
  const verdict = mapVerdict(verdictText);
  if (!verdict.known) importer.unknownState(`review verdict "${verdictText}" in ${ctx.file}`);
  if (scoreText !== "" && !Number.isNaN(score)) {
    const reasons = [verdictText === "" ? "legacy review" : `legacy verdict: ${verdictText}`];
    importer.score(key, score, reasons, `${date}:${ctx.file}`);
  }
  if (verdict.state !== null) importer.status(key, verdict.state, `${date}:review`);
  importer.note(key, describe("review", ctx, date, row, [`verdict ${verdictText}`]));
}

function importApplicationRow(row: TableRow, ctx: FileContext): void {
  const { importer } = ctx;
  const date = rowDate(row, ctx.fallbackDate);
  const key = importer.lead(toPosting(row, date));
  const stateText = row["state"] ?? "";
  const state = stateText === "" ? "applied" : mapState(stateText);
  if (state === null) importer.unknownState(`application state "${stateText}" in ${ctx.file}`);
  else if (state !== "lead") importer.status(key, state, `${date}:application`);
  importer.note(key, describe("application", ctx, date, row, [`state ${stateText}`]));
}

function importRowFile(
  file: string,
  importer: Importer,
  importRow: (row: TableRow, ctx: FileContext) => void,
): void {
  const ctx = fileContext(file, importer);
  for (const rows of parseTables(readFileSync(file, "utf8"))) {
    if (!hasColumns(rows, ["company", "role"])) continue;
    for (const row of rows.filter(isRoleRow)) importRow(row, ctx);
  }
}

export function importLegacy(ctx: CommandContext, dir: string): Promise<ImportResult> {
  if (ctx.dataDir === null) {
    return Promise.resolve({
      ok: false,
      error: { code: "data-dir-not-found", message: "no data dir resolved; pass --data or set HUNTLINE_HOME" },
    });
  }
  const root = path.resolve(ctx.cwd, dir);
  if (!isDirectory(root)) {
    return Promise.resolve({ ok: false, error: { code: "usage", message: `${root} is not a directory` } });
  }
  return withImporter(ctx.dataDir, "legacy", "migrate-legacy.json", (importer) => {
    for (const dateDirectory of subdirectories(path.join(root, "sweeps"))) {
      const date = DATE_PATTERN.exec(path.basename(dateDirectory))?.[0] ?? "";
      for (const file of markdownFiles(dateDirectory)) importSweepFile(file, date, importer);
    }
    for (const file of markdownFiles(path.join(root, "reviews"))) {
      importRowFile(file, importer, importReviewRow);
    }
    for (const file of markdownFiles(path.join(root, "applications"))) {
      importRowFile(file, importer, importApplicationRow);
    }
  });
}
