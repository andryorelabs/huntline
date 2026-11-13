import { errorMessage, isObject } from "../core/narrow.ts";

export type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

export type JsonOutcome =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly error: string };

const MAX_BODY_CHARS = 8_000_000;

type TextOutcome =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly error: string };

async function requestText(
  fetchFunction: FetchFunction,
  url: string,
  init: RequestInit,
): Promise<TextOutcome> {
  let response: Response;
  try {
    response = await fetchFunction(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    return { ok: false, error: `network error for ${url}: ${errorMessage(error)}` };
  }
  if (response.status === 429) return { ok: false, error: `HTTP 429 rate limited by ${url}` };
  if (!response.ok) return { ok: false, error: `HTTP ${response.status} from ${url}` };
  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    return { ok: false, error: `unreadable response from ${url}: ${errorMessage(error)}` };
  }
  if (body.length > MAX_BODY_CHARS) return { ok: false, error: `response too large from ${url}` };
  return { ok: true, body };
}

function parseJson(outcome: TextOutcome, url: string): JsonOutcome {
  if (!outcome.ok) return outcome;
  try {
    return { ok: true, body: JSON.parse(outcome.body) };
  } catch (error) {
    return { ok: false, error: `invalid JSON from ${url}: ${errorMessage(error)}` };
  }
}

export async function getJson(
  fetchFunction: FetchFunction,
  url: string,
  headers: Record<string, string> = {},
): Promise<JsonOutcome> {
  const outcome = await requestText(fetchFunction, url, {
    headers: { accept: "application/json", ...headers },
  });
  return parseJson(outcome, url);
}

/**
 * Read-only search helper for boards that expose search as a POST. It sends only the board's
 * search body and never user data.
 */
export async function postJson(
  fetchFunction: FetchFunction,
  url: string,
  searchBody: unknown,
): Promise<JsonOutcome> {
  const outcome = await requestText(fetchFunction, url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(searchBody),
  });
  return parseJson(outcome, url);
}

export function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function identifier(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  return text(value);
}

export function records(value: unknown): Record<string, unknown>[] | undefined {
  return Array.isArray(value) ? value.filter(isObject) : undefined;
}

export function field(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined;
}

const SECONDS_THRESHOLD = 100_000_000_000;

export function isoDate(value: unknown): string | undefined {
  const numeric =
    typeof value === "number"
      ? Math.abs(value) < SECONDS_THRESHOLD
        ? value * 1000
        : value
      : undefined;
  const raw = numeric ?? text(value);
  if (raw === undefined) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function stripHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<(br|\/p|\/li|\/div)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .trim();
}
