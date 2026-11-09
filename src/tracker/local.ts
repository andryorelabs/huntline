import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeAtomic } from "../core/fs.ts";
import { errorMessage } from "../core/narrow.ts";
import type { ApplicationState, DataDir, Lead, Result, TrackerAdapter } from "../core/types.ts";
import { readEvents } from "../ledger/events.ts";

export const DEFAULT_LOCAL_DIRECTORY = "applications";

const EVENTS_HEADING = "## Events";

type Frontmatter = Record<string, string | number | null>;

type ParsedFile = { readonly frontmatter: Frontmatter; readonly events: string[] };

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

export function slugForKey(key: string): string {
  const cleaned = key.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (cleaned === key && cleaned !== "") return cleaned;
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 8);
  return `${cleaned.slice(0, 60) || "application"}-${digest}`;
}

function renderFile(parsed: ParsedFile, title: string): string {
  const frontmatter = Object.entries(parsed.frontmatter)
    .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
    .join("\n");
  const events = parsed.events.length === 0 ? "" : `${parsed.events.join("\n")}\n`;
  return `---\n${frontmatter}\n---\n\n# ${title}\n\n${EVENTS_HEADING}\n\n${events}`;
}

function parseScalar(raw: string): string | number | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "string" || typeof value === "number" || value === null) return value;
  } catch {
    return raw;
  }
  return raw;
}

function parseFile(content: string): ParsedFile {
  const lines = content.split("\n");
  const frontmatter: Frontmatter = {};
  let cursor = 0;
  if (lines[0] === "---") {
    cursor = 1;
    while (cursor < lines.length && lines[cursor] !== "---") {
      const line = lines[cursor] ?? "";
      const separator = line.indexOf(": ");
      if (separator > 0) frontmatter[line.slice(0, separator)] = parseScalar(line.slice(separator + 2));
      cursor += 1;
    }
    cursor += 1;
  }
  const headingIndex = lines.indexOf(EVENTS_HEADING, cursor);
  const events =
    headingIndex === -1 ? [] : lines.slice(headingIndex + 1).filter((line) => line.trim() !== "");
  return { frontmatter, events };
}

async function derivedFields(
  dir: DataDir,
  key: string,
): Promise<{ score: number | null; rejection: string | null }> {
  let score: number | null = null;
  let rejection: string | null = null;
  for (const event of await readEvents(dir, key)) {
    if (event.kind === "score.recorded") score = event.score;
    if (event.kind === "posting.dismissed") rejection = event.reason;
  }
  return { score, rejection };
}

function titleOf(parsed: ParsedFile, key: string): string {
  const company = parsed.frontmatter["company"];
  const title = parsed.frontmatter["title"];
  return typeof company === "string" && typeof title === "string" ? `${title} at ${company}` : key;
}

async function guarded<T>(operation: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await operation();
  } catch (error) {
    return fail("tracker-local-failed", errorMessage(error));
  }
}

export function createLocalTracker(directory: string | undefined, dir: DataDir): TrackerAdapter {
  const root = path.resolve(dir.path, directory ?? DEFAULT_LOCAL_DIRECTORY);

  function fileFor(key: string): string {
    return path.join(root, `${slugForKey(key)}.md`);
  }

  function load(key: string): ParsedFile | null {
    const file = fileFor(key);
    return existsSync(file) ? parseFile(readFileSync(file, "utf8")) : null;
  }

  async function save(key: string, parsed: ParsedFile): Promise<void> {
    const derived = await derivedFields(dir, key);
    const frontmatter: Frontmatter = {
      ...parsed.frontmatter,
      score: derived.score ?? parsed.frontmatter["score"] ?? null,
      rejection_reason: derived.rejection ?? parsed.frontmatter["rejection_reason"] ?? null,
    };
    writeAtomic(fileFor(key), renderFile({ frontmatter, events: parsed.events }, titleOf(parsed, key)));
  }

  return {
    upsertLead(lead: Lead): Promise<Result<string>> {
      return guarded(async () => {
        const parsed: ParsedFile = load(lead.key) ?? {
          frontmatter: {
            key: lead.key,
            url: lead.posting.url,
            source: lead.posting.source,
            company: lead.posting.company,
            title: lead.posting.title,
            dedup_key: lead.key,
            eligibility: lead.eligibility,
            status: "lead",
          },
          events: [`- lead created (${lead.eligibility})`],
        };
        await save(lead.key, parsed);
        return { ok: true, value: fileFor(lead.key) };
      });
    },
    setStatus(key: string, state: ApplicationState): Promise<Result<void>> {
      return guarded(async () => {
        const existing = load(key);
        if (existing === null) return fail("tracker-not-found", `no local file for ${key}`);
        await save(key, {
          frontmatter: { ...existing.frontmatter, status: state },
          events: [...existing.events, `- status: ${state}`],
        });
        return { ok: true, value: undefined };
      });
    },
    comment(key: string, text: string): Promise<Result<void>> {
      return guarded(async () => {
        const existing = load(key);
        if (existing === null) return fail("tracker-not-found", `no local file for ${key}`);
        const flattened = text.replace(/\s*\n\s*/g, " ");
        await save(key, { ...existing, events: [...existing.events, `- ${flattened}`] });
        return { ok: true, value: undefined };
      });
    },
    find(key: string): Promise<Result<string | null>> {
      const file = fileFor(key);
      return Promise.resolve({ ok: true, value: existsSync(file) ? file : null });
    },
  };
}
