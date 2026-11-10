import type { Posting, SourceAdapter, SourceQuery, SourceResult } from "../core/types.ts";
import { getJson, type FetchFunction } from "./http.ts";

export type Parsed = { readonly postings: Posting[]; readonly warnings: string[] };
export type ParseFailure = { readonly error: string };

export type AdapterSpec = {
  readonly name: string;
  readonly requiresSlug: boolean;
  url(query: SourceQuery): string;
  parse(body: unknown, query: SourceQuery): Parsed | ParseFailure;
};

function isParseFailure(value: Parsed | ParseFailure): value is ParseFailure {
  return "error" in value;
}

function failed(message: string): SourceResult {
  return { postings: [], errors: [message], warnings: [] };
}

export function defineAdapter(spec: AdapterSpec, fetchFunction: FetchFunction): SourceAdapter {
  return {
    name: spec.name,
    async fetch(query) {
      if (spec.requiresSlug && (query.slug === undefined || query.slug === "")) {
        return failed(`${spec.name}: a company slug is required`);
      }
      const outcome = await getJson(fetchFunction, spec.url(query));
      if (!outcome.ok) return failed(`${spec.name}: ${outcome.error}`);
      const parsed = spec.parse(outcome.body, query);
      if (isParseFailure(parsed)) return failed(`${spec.name}: ${parsed.error}`);
      return { postings: parsed.postings, errors: [], warnings: parsed.warnings };
    },
  };
}

export function matchesKeywords(
  posting: Posting,
  keywords: readonly string[] | undefined,
): boolean {
  if (keywords === undefined || keywords.length === 0) return true;
  const haystack = [posting.title, posting.description ?? "", ...(posting.stack ?? [])]
    .join(" ")
    .toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

export function withOptional(base: Posting, extras: Record<string, unknown>): Posting {
  const entries = Object.entries(extras).filter(([, value]) => value !== undefined);
  return { ...base, ...Object.fromEntries(entries) };
}

export type RowMapper = (row: Record<string, unknown>) => Posting | undefined;

export function mapRows(
  rows: Record<string, unknown>[] | undefined,
  label: string,
  mapper: RowMapper,
): Parsed | ParseFailure {
  if (rows === undefined) return { error: `unexpected response shape, missing ${label}` };
  const postings: Posting[] = [];
  const warnings: string[] = [];
  rows.forEach((row, index) => {
    const posting = mapper(row);
    if (posting === undefined)
      warnings.push(`skipped ${label} entry ${index} without id, title or url`);
    else postings.push(posting);
  });
  return { postings, warnings };
}
