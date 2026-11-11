import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import type { ApplicationState, Posting } from "../core/types.ts";
import {
  legacyIdNote,
  linkLegacyIds,
  withImporter,
  type Importer,
  type KeyedId,
} from "./importer.ts";
import { mapOutcome, mapState, mapVerdict } from "./states.ts";
import { headersMatch, parseTableBlocks, type TableBlock, type TableRow } from "./table.ts";
import { leadIdentity, leadPosting, parseSweepLeads } from "./sweep-leads.ts";
import { splitCompanyRole } from "./title.ts";
import type { ImportResult } from "./types.ts";

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

type LegacyFile = {
  readonly absolute: string;
  readonly display: string;
  readonly name: string;
  readonly date: string;
};

type FileContext = {
  readonly importer: Importer;
  readonly file: string;
  readonly display: string;
  readonly fallbackDate: string;
};

function isDirectory(candidate: string): boolean {
  return existsSync(candidate) && statSync(candidate).isDirectory();
}

function isReadme(name: string): boolean {
  return name.toLowerCase() === "readme.md";
}

function walk(directory: string, root: string, inheritedDate: string): LegacyFile[] {
  if (!isDirectory(directory)) return [];
  return readdirSync(directory)
    .toSorted()
    .flatMap((name) => {
      const absolute = path.join(directory, name);
      if (lstatSync(absolute).isSymbolicLink()) return [];
      if (isDirectory(absolute)) {
        return walk(absolute, root, DATE_PATTERN.exec(name)?.[0] ?? inheritedDate);
      }
      if (!name.endsWith(".md") || isReadme(name)) return [];
      const date = inheritedDate === "" ? (DATE_PATTERN.exec(name)?.[0] ?? "") : inheritedDate;
      return [{ absolute, display: path.relative(root, absolute), name, date }];
    });
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

function withCompany(row: TableRow): TableRow {
  if ((row["company"] ?? "") !== "" || (row["role"] ?? "") === "") return row;
  const split = splitCompanyRole(row["role"] ?? "");
  return split.company === "" ? row : { ...row, company: split.company, role: split.role };
}

function isRoleRow(row: TableRow): boolean {
  return (row["company"] ?? "") !== "" && (row["role"] ?? "") !== "";
}

const COVERAGE_HEADERS: readonly (readonly string[])[] = [
  ["portal", "status", "counts", "note"],
  ["unit", "kind", "status", "counts"],
  ["card", "source file", "status", "counts"],
];
const LEAD_OUTCOME_HEADERS: readonly string[] = ["lead", "linear", "outcome", "detail"];

function isCoverageTable(block: TableBlock): boolean {
  return COVERAGE_HEADERS.some((expected) => headersMatch(block, expected));
}

function isLeadOutcomeTable(block: TableBlock): boolean {
  return headersMatch(block, LEAD_OUTCOME_HEADERS);
}

function isRecognised(block: TableBlock): boolean {
  return block.columns.includes("company") || block.columns.includes("role");
}

function describe(
  kind: string,
  ctx: FileContext,
  date: string,
  row: TableRow,
  extra: string[],
): string {
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

function extras(row: TableRow, names: readonly string[]): string[] {
  return names.flatMap((name) => ((row[name] ?? "") === "" ? [] : [`${name} ${row[name]}`]));
}

function readFile(file: LegacyFile, importer: Importer): string | null {
  try {
    return readFileSync(file.absolute, "utf8");
  } catch {
    importer.warn(`cannot read ${file.display}; skipped`);
    return null;
  }
}

function warnUnrecognised(block: TableBlock, ctx: FileContext): void {
  ctx.importer.warn(
    `table without a recognised company or title column in ${ctx.display}: headers ${block.headers.join(", ")}`,
  );
}

function warnRow(ctx: FileContext, row: TableRow): void {
  const label = row["role"] ?? row["company"] ?? "";
  ctx.importer.warn(
    `row without company and role in ${ctx.display}${label === "" ? "" : `: "${label}"`}; skipped`,
  );
}

function roleRows(block: TableBlock, ctx: FileContext): TableRow[] {
  return block.rows.map(withCompany).filter((row) => {
    if (isRoleRow(row)) return true;
    warnRow(ctx, row);
    return false;
  });
}

function importCoverage(rows: readonly TableRow[], ctx: FileContext): void {
  for (const row of rows) {
    const company = row["company"] ?? "";
    if (company === "") continue;
    const date = rowDate(row, ctx.fallbackDate);
    const result = row["state"] ?? row["verdict"] ?? "";
    ctx.importer.note(
      `company:${company.toLowerCase()}`,
      describe("coverage", ctx, date, row, [
        `company ${company}`,
        result === "" ? "" : `result ${result}`,
        ...extras(row, ["portal", "card", "cards", "unit", "units"]),
      ]),
    );
  }
}

function fileContext(file: LegacyFile, importer: Importer): FileContext {
  return { importer, file: file.name, display: file.display, fallbackDate: file.date };
}

function sweepLeadNote(fields: Readonly<Record<string, string>>): string[] {
  return ["fit", "salary", "posted"].flatMap((name) =>
    (fields[name] ?? "") === "" ? [] : [`${name} ${fields[name]}`],
  );
}

function importSweepLeads(markdown: string, ctx: FileContext): number {
  const leads = parseSweepLeads(markdown);
  for (const lead of leads) {
    const { company, role } = leadIdentity(lead);
    if (company === "" || role === "") {
      ctx.importer.warn(
        `sweep lead "${lead.heading}" in ${ctx.display} has no company or role; skipped`,
      );
      continue;
    }
    const posting = leadPosting(lead, company, role, ctx.fallbackDate);
    const key = ctx.importer.lead(posting);
    ctx.importer.note(
      key,
      describe("sweep", ctx, ctx.fallbackDate, {}, sweepLeadNote(lead.fields)),
    );
  }
  return leads.length;
}

function importSweepFile(file: LegacyFile, importer: Importer): void {
  const markdown = readFile(file, importer);
  if (markdown === null) return;
  const ctx = fileContext(file, importer);
  const blocks = parseTableBlocks(markdown);
  for (const block of blocks) {
    if (isCoverageTable(block)) continue;
    if (!isRecognised(block)) {
      warnUnrecognised(block, ctx);
    } else if (block.columns.includes("role")) {
      for (const row of roleRows(block, ctx)) {
        const date = rowDate(row, ctx.fallbackDate);
        const key = importer.lead(toPosting(row, date));
        importer.note(key, describe("sweep", ctx, date, row, []));
      }
    } else {
      importCoverage(block.rows, ctx);
    }
  }
  const leadCount = importSweepLeads(markdown, ctx);
  if (blocks.length === 0 && leadCount === 0)
    importer.warn(`no parseable content in ${file.display}`);
}

function importReviewRow(row: TableRow, ctx: FileContext, postingById: Map<string, Posting>): void {
  const { importer } = ctx;
  const date = rowDate(row, ctx.fallbackDate);
  const posting = toPosting(row, date);
  const key = importer.lead(posting);
  if ((row["id"] ?? "") !== "") postingById.set(row["id"] ?? "", posting);
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
  importer.note(
    key,
    describe("review", ctx, date, row, [
      `verdict ${verdictText}`,
      ...extras(row, ["id", "reason", "priority"]),
      ...(scoreText !== "" && Number.isNaN(score) ? [`fit ${scoreText}`] : []),
    ]),
  );
}

function importReviewFile(
  file: LegacyFile,
  importer: Importer,
  postingById: Map<string, Posting>,
): void {
  const markdown = readFile(file, importer);
  if (markdown === null) return;
  const ctx = fileContext(file, importer);
  const blocks = parseTableBlocks(markdown);
  if (blocks.length === 0) importer.warn(`no parseable content in ${file.display}`);
  for (const block of blocks) {
    if (isCoverageTable(block)) continue;
    if (!isRecognised(block)) warnUnrecognised(block, ctx);
    else for (const row of roleRows(block, ctx)) importReviewRow(row, ctx, postingById);
  }
}

type ApplicationEntry = {
  readonly row: TableRow;
  readonly ctx: FileContext;
  readonly followUp: boolean;
  readonly legacyId: string;
};

type OutcomeMapping = {
  readonly known: boolean;
  readonly state: ApplicationState | null;
  readonly label: string;
  readonly text: string;
};

function applicationOutcome(row: TableRow): OutcomeMapping {
  if ("outcome" in row) {
    const text = row["outcome"] ?? "";
    return { ...mapOutcome(text), label: "outcome", text };
  }
  const text = row["state"] ?? "";
  const state = text === "" ? "applied" : mapState(text);
  return { known: state !== null, state: state === "lead" ? null : state, label: "state", text };
}

function leadOutcomeEntry(row: TableRow, ctx: FileContext, followUp: boolean): ApplicationEntry {
  const { company, role } = splitCompanyRole(row["lead"] ?? "");
  const mapped: TableRow = {
    outcome: row["outcome"] ?? "",
    notes: row["notes"] ?? "",
    company,
    role,
  };
  return { row: mapped, ctx, followUp, legacyId: row["linear"] ?? "" };
}

function collectApplicationRows(file: LegacyFile, importer: Importer): ApplicationEntry[] {
  const markdown = readFile(file, importer);
  if (markdown === null) return [];
  const ctx = fileContext(file, importer);
  const followUp = /follow-?up/i.test(file.name);
  const blocks = parseTableBlocks(markdown);
  if (blocks.length === 0) importer.warn(`no parseable content in ${file.display}`);
  return blocks.flatMap((block) => {
    if (isCoverageTable(block)) return [];
    if (isLeadOutcomeTable(block))
      return block.rows.map((row) => leadOutcomeEntry(row, ctx, followUp));
    if (!isRecognised(block)) {
      warnUnrecognised(block, ctx);
      return [];
    }
    return block.rows.map(withCompany).map((row) => ({ row, ctx, followUp, legacyId: "" }));
  });
}

function fillFromIds(
  entries: readonly ApplicationEntry[],
  postingById: Map<string, Posting>,
): ApplicationEntry[] {
  for (const { row } of entries) {
    const id = row["id"] ?? "";
    if (id !== "" && isRoleRow(row) && !postingById.has(id))
      postingById.set(id, toPosting(row, ""));
  }
  return entries.map((entry) => {
    const known = postingById.get(entry.row["id"] ?? "");
    if (isRoleRow(entry.row) || known === undefined) return entry;
    return { ...entry, row: { ...entry.row, company: known.company, role: known.title } };
  });
}

function effectiveState(
  group: readonly (ApplicationEntry & { mapping: OutcomeMapping })[],
): ApplicationState | null {
  const stateful = (followUp: boolean) =>
    group.findLast((entry) => entry.followUp === followUp && entry.mapping.state !== null)?.mapping
      .state ?? null;
  return stateful(true) ?? stateful(false);
}

function importApplications(entries: readonly ApplicationEntry[], importer: Importer): KeyedId[] {
  const legacy: KeyedId[] = [];
  const groups = new Map<string, (ApplicationEntry & { mapping: OutcomeMapping })[]>();
  const keys = new Map<string, string>();
  for (const entry of entries) {
    const { row, ctx } = entry;
    if (!isRoleRow(row)) {
      warnRow(ctx, row);
      continue;
    }
    const date = rowDate(row, ctx.fallbackDate);
    const mapping = applicationOutcome(row);
    if (!mapping.known)
      importer.unknownState(`application ${mapping.label} "${mapping.text}" in ${ctx.file}`);
    const key = importer.lead(toPosting(row, date));
    const groupKey = (row["id"] ?? "") === "" ? key : `id:${row["id"]}`;
    keys.set(groupKey, key);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), { ...entry, mapping }]);
    if (entry.legacyId !== "") {
      importer.note(key, legacyIdNote(entry.legacyId));
      legacy.push({ id: entry.legacyId, key });
    }
    importer.note(
      key,
      describe("application", ctx, date, row, [
        `${mapping.label} ${mapping.text}`,
        ...(entry.followUp ? ["follow-up"] : []),
        ...extras(row, ["id"]),
      ]),
    );
  }
  for (const [groupKey, group] of groups) {
    const state = effectiveState(group);
    const key = keys.get(groupKey);
    const winner = group.findLast((entry) => entry.mapping.state === state);
    if (state === null || key === undefined || winner === undefined) continue;
    importer.status(key, state, `${rowDate(winner.row, winner.ctx.fallbackDate)}:application`);
  }
  return legacy;
}

export function importLegacy(ctx: CommandContext, dir: string): Promise<ImportResult> {
  if (ctx.dataDir === null) {
    return Promise.resolve({
      ok: false,
      error: {
        code: "data-dir-not-found",
        message: "no data dir resolved; pass --data or set JOBSHIP_HOME",
      },
    });
  }
  const root = path.resolve(ctx.cwd, dir);
  if (!isDirectory(root)) {
    return Promise.resolve({
      ok: false,
      error: { code: "usage", message: `${root} is not a directory` },
    });
  }
  return withImporter(ctx.dataDir, "legacy", "migrate-legacy.json", (importer) => {
    const postingById = new Map<string, Posting>();
    for (const file of walk(path.join(root, "sweeps"), root, "")) importSweepFile(file, importer);
    for (const file of walk(path.join(root, "reviews"), root, ""))
      importReviewFile(file, importer, postingById);
    const entries = walk(path.join(root, "applications"), root, "").flatMap((file) =>
      collectApplicationRows(file, importer),
    );
    const legacy = importApplications(fillFromIds(entries, postingById), importer);
    linkLegacyIds(importer, { legacy, linear: [], reportUnmatched: false });
  });
}
