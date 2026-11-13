import type { Posting, SourceAdapter, SourceQuery, SourceResult } from "../core/types.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import { matchesKeywords } from "./adapter.ts";
import {
  field,
  getJson,
  isoDate,
  readCapped,
  records,
  text,
  type FetchFunction,
  type JsonOutcome,
} from "./http.ts";

const TOKEN_URL = "https://pam-stilling-feed.nav.no/api/publicToken";
const POSTING_BASE = "https://arbeidsplassen.nav.no/stillinger/stilling";
const MAX_PAGES = 10;
const MAX_DETAILS = 50;
const MAX_TOKEN_BYTES = 16_000;
const JWT_PATTERN = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;

type Page = {
  readonly id: string;
  readonly nextId: string | undefined;
  readonly items: Record<string, unknown>[];
};

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly notFound: boolean };

function failure(error: string): { ok: false; error: string; notFound: boolean } {
  return { ok: false, error, notFound: error.startsWith("HTTP 404") };
}

async function fetchToken(fetchFunction: FetchFunction): Promise<Outcome<string>> {
  try {
    const response = await fetchFunction(TOKEN_URL, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return failure(`token request failed: HTTP ${response.status}`);
    const content = await readCapped(response, TOKEN_URL, MAX_TOKEN_BYTES);
    if (!content.ok) return failure(content.error);
    const token = JWT_PATTERN.exec(new TextDecoder().decode(content.value))?.[0];
    return token === undefined
      ? failure("token response held no token")
      : { ok: true, value: token };
  } catch (error) {
    return failure(`token request failed: ${errorMessage(error)}`);
  }
}

async function getAuthorized(
  fetchFunction: FetchFunction,
  url: string,
  token: string,
): Promise<Outcome<unknown>> {
  const outcome: JsonOutcome = await getJson(fetchFunction, url, {
    authorization: `Bearer ${token}`,
  });
  if (!outcome.ok) return failure(outcome.error.replace(/^HTTP (\d+) from .*$/, "HTTP $1"));
  return { ok: true, value: outcome.body };
}

function parsePage(body: unknown): Page | undefined {
  const id = text(field(body, "id"));
  const items = records(field(body, "items"));
  if (id === undefined || items === undefined) return undefined;
  return { id, nextId: text(field(body, "next_id")), items };
}

function entryOf(item: Record<string, unknown>): Record<string, unknown> | undefined {
  const entry = field(item, "_feed_entry");
  return isObject(entry) ? entry : undefined;
}

function isActive(item: Record<string, unknown>): boolean {
  return field(entryOf(item), "status") === "ACTIVE";
}

function toPosting(item: Record<string, unknown>): Posting | undefined {
  const entry = entryOf(item);
  const uuid = text(field(entry, "uuid")) ?? text(item["id"]);
  const title = text(field(entry, "title")) ?? text(item["title"]);
  if (uuid === undefined || title === undefined) return undefined;
  const location = text(field(entry, "municipal"));
  const postedAt = isoDate(field(entry, "sistEndret")) ?? isoDate(item["date_modified"]);
  return {
    id: `nav:${uuid}`,
    source: "nav",
    url: `${POSTING_BASE}/${encodeURIComponent(uuid)}`,
    company: text(field(entry, "businessName")) ?? "",
    title,
    ...(location === undefined ? {} : { location }),
    ...(postedAt === undefined ? {} : { postedAt }),
  };
}

function failed(message: string): SourceResult {
  return { postings: [], errors: [`nav: ${message}`], warnings: [] };
}

type WalkState = {
  readonly postings: readonly Posting[];
  readonly warnings: readonly string[];
  readonly nextCursor: string;
  readonly pages: number;
  readonly details: number;
};

type CollectStep =
  | { readonly kind: "done"; readonly state: WalkState; readonly complete: boolean }
  | { readonly kind: "error"; readonly error: string };

type WalkStep =
  | { readonly kind: "done"; readonly state: WalkState }
  | { readonly kind: "reset" }
  | { readonly kind: "error"; readonly error: string };

/**
 * Reads the NAV job vacancy feed. The first sweep only records the newest feed page as a
 * cursor; later sweeps read forward from the cursor, so only entries published since the
 * previous sweep become Postings. Requests are GETs with the public feed token.
 */
export function createNavAdapter(fetchFunction: FetchFunction, endpoint: string): SourceAdapter {
  const base = endpoint.replace(/\/+$/, "");
  const entryBase = base.replace(/\/feed$/, "/feedentry");

  async function readPage(token: string, pageId: string): Promise<Outcome<Page>> {
    const url = pageId === "?last" ? `${base}?last` : `${base}/${encodeURIComponent(pageId)}`;
    const outcome = await getAuthorized(fetchFunction, url, token);
    if (!outcome.ok) return outcome;
    const page = parsePage(outcome.value);
    return page === undefined
      ? failure("unexpected response shape from the feed")
      : { ok: true, value: page };
  }

  async function confirmActive(token: string, uuid: string): Promise<Outcome<boolean>> {
    const outcome = await getAuthorized(
      fetchFunction,
      `${entryBase}/${encodeURIComponent(uuid)}`,
      token,
    );
    if (!outcome.ok) return outcome;
    return { ok: true, value: field(outcome.value, "status") === "ACTIVE" };
  }

  async function initialize(token: string, warning: string): Promise<SourceResult> {
    const last = await readPage(token, "?last");
    if (!last.ok) return failed(last.error);
    return {
      postings: [],
      errors: [],
      warnings: [warning],
      nextCursor: last.value.id,
    };
  }

  async function collect(
    token: string,
    items: readonly Record<string, unknown>[],
    state: WalkState,
    query: SourceQuery,
  ): Promise<CollectStep> {
    const item = items[0];
    if (item === undefined) return { kind: "done", state, complete: true };
    if (state.details >= MAX_DETAILS) return { kind: "done", state, complete: false };
    const posting = toPosting(item);
    if (posting === undefined) return collect(token, items.slice(1), state, query);
    const confirmed = await confirmActive(token, posting.id.slice("nav:".length));
    if (!confirmed.ok) return { kind: "error", error: confirmed.error };
    const keep = confirmed.value && matchesKeywords(posting, query.keywords);
    return collect(
      token,
      items.slice(1),
      {
        ...state,
        details: state.details + 1,
        postings: keep ? [...state.postings, posting] : state.postings,
      },
      query,
    );
  }

  async function walk(
    token: string,
    pageId: string,
    state: WalkState,
    query: SourceQuery,
  ): Promise<WalkStep> {
    if (state.pages >= MAX_PAGES) {
      return {
        kind: "done",
        state: {
          ...state,
          warnings: [
            ...state.warnings,
            `nav: stopped after ${MAX_PAGES} pages; resuming next sweep`,
          ],
        },
      };
    }
    const page = await readPage(token, pageId);
    if (!page.ok) {
      return page.notFound && state.pages === 0
        ? { kind: "reset" }
        : { kind: "error", error: page.error };
    }
    const collected = await collect(token, page.value.items.filter(isActive), state, query);
    if (collected.kind === "error") return collected;
    if (!collected.complete) {
      return {
        kind: "done",
        state: {
          ...collected.state,
          warnings: [
            ...collected.state.warnings,
            `nav: stopped after ${MAX_DETAILS} entries; resuming next sweep`,
          ],
        },
      };
    }
    const advanced = { ...collected.state, pages: state.pages + 1, nextCursor: page.value.id };
    if (page.value.nextId === undefined) return { kind: "done", state: advanced };
    return walk(token, page.value.nextId, advanced, query);
  }

  return {
    name: "nav",
    async fetch(query: SourceQuery): Promise<SourceResult> {
      const token = await fetchToken(fetchFunction);
      if (!token.ok) return failed(token.error);
      if (query.cursor === undefined || query.cursor === "") {
        return initialize(token.value, "nav: cursor initialized; Postings arrive on later sweeps");
      }
      const walked = await walk(
        token.value,
        query.cursor,
        { postings: [], warnings: [], nextCursor: query.cursor, pages: 0, details: 0 },
        query,
      );
      if (walked.kind === "reset") {
        return initialize(
          token.value,
          "nav: stored cursor is no longer served; restarted from the latest page",
        );
      }
      if (walked.kind === "error") return failed(walked.error);
      const { postings, warnings, nextCursor } = walked.state;
      return { postings: [...postings], errors: [], warnings: [...warnings], nextCursor };
    },
  };
}
