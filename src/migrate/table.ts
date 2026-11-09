export type TableRow = Readonly<Record<string, string>>;

const ALIASES: Readonly<Record<string, readonly string[]>> = {
  company: ["company", "employer", "organization"],
  role: ["role", "title", "position"],
  url: ["url", "link", "posting"],
  channel: ["channel", "source", "via"],
  state: ["state", "status", "stage"],
  date: ["date", "applied", "reviewed", "day"],
  score: ["score", "fit", "rating"],
  verdict: ["verdict", "decision", "result"],
  outcome: ["outcome"],
  id: ["id"],
  reason: ["reason"],
  notes: ["notes", "note", "comment", "comments"],
};

function splitCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparator(line: string): boolean {
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(line.trim());
}

function canonicalHeader(header: string): string {
  const lowered = header.toLowerCase().replace(/[^a-z ]/g, "").trim();
  for (const [canonical, names] of Object.entries(ALIASES)) {
    if (names.includes(lowered)) return canonical;
  }
  return lowered;
}

function stripMarkdown(cell: string): string {
  const linked = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(cell);
  if (linked === null) return cell;
  return linked[1] === "" ? (linked[2] ?? "") : (linked[1] ?? "");
}

export function extractUrl(cell: string): string {
  const linked = /\]\(([^)\s]+)\)/.exec(cell);
  if (linked?.[1] !== undefined) return linked[1];
  const bare = /https?:\/\/[^\s|)>]+/.exec(cell);
  return bare?.[0] ?? "";
}

export type TableBlock = {
  readonly headers: readonly string[];
  readonly columns: readonly string[];
  readonly rows: TableRow[];
};

export function parseTables(markdown: string): TableRow[][] {
  return parseTableBlocks(markdown).map((block) => block.rows);
}

export function parseTableBlocks(markdown: string): TableBlock[] {
  const lines = markdown.split(/\r?\n/);
  const tables: TableBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const header = lines[index] ?? "";
    const separator = lines[index + 1];
    if (!header.trim().startsWith("|") || separator === undefined || !isSeparator(separator)) {
      index += 1;
      continue;
    }
    const headers = splitCells(header);
    const names = headers.map(canonicalHeader);
    const rows: TableRow[] = [];
    index += 2;
    while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
      const cells = splitCells(lines[index] ?? "");
      const row: Record<string, string> = {};
      for (const [position, name] of names.entries()) {
        const raw = cells[position] ?? "";
        row[name] = name === "url" ? extractUrl(raw) : stripMarkdown(raw);
      }
      rows.push(row);
      index += 1;
    }
    tables.push({ headers, columns: names, rows });
  }
  return tables;
}

export function hasColumns(rows: readonly TableRow[], columns: readonly string[]): boolean {
  const first = rows[0];
  return first !== undefined && columns.every((column) => column in first);
}
