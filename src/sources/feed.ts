import { XMLParser } from "fast-xml-parser";
import { errorMessage, isObject, isOneOf } from "../core/narrow.ts";
import type { Posting, SourceAdapter, SourceQuery, SourceResult } from "../core/types.ts";
import { matchesKeywords, withOptional } from "./adapter.ts";
import { isoDate, stripHtml, text, type FetchFunction } from "./http.ts";

export type FeedOptions = {
  readonly id: string;
  readonly endpoint: string;
  readonly encoding?: string;
};

export type XmlFeedOptions = {
  readonly id: string;
  readonly endpoint: string;
};

type Node = Record<string, unknown>;
type Mapped = { readonly postings: Posting[]; readonly warnings: string[] };
type Outcome<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: string };

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_COMPANY_PREFIX = 60;
const ROOT_SEARCH_DEPTH = 3;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: false,
});

async function readCapped(response: Response, url: string): Promise<Outcome<Uint8Array>> {
  const tooLarge = { ok: false, error: `response from ${url} is too large` } as const;
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) return tooLarge;
  if (response.body === null) return { ok: true, value: new Uint8Array() };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > MAX_RESPONSE_BYTES) return tooLarge;
    chunks.push(chunk);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: merged };
}

function declaredEncoding(content: Uint8Array): string | undefined {
  const head = new TextDecoder("latin1").decode(content.subarray(0, 200));
  return /^\s*<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1];
}

const SUPPORTED_ENCODINGS = [
  "utf-8",
  "utf-16le",
  "iso-8859-1",
  "iso-8859-2",
  "iso-8859-15",
  "windows-1250",
  "windows-1252",
] as const;

const ENCODING_ALIASES: Record<string, (typeof SUPPORTED_ENCODINGS)[number]> = {
  utf8: "utf-8",
  latin1: "iso-8859-1",
  "iso8859-1": "iso-8859-1",
  "us-ascii": "windows-1252",
  ascii: "windows-1252",
  latin9: "iso-8859-15",
};

function decode(content: Uint8Array, encoding: string | undefined): Outcome<string> {
  const label = (encoding ?? declaredEncoding(content) ?? "utf-8").toLowerCase();
  const normalized = ENCODING_ALIASES[label] ?? label;
  if (!isOneOf(SUPPORTED_ENCODINGS, normalized)) {
    return { ok: false, error: `unsupported encoding ${label}` };
  }
  try {
    return { ok: true, value: new TextDecoder(normalized).decode(content) };
  } catch (error) {
    return { ok: false, error: `cannot decode as ${label}: ${errorMessage(error)}` };
  }
}

function balanceError(xml: string): string | undefined {
  const stripped = xml
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");
  const stack: string[] = [];
  for (const match of stripped.matchAll(/<(\/?)([^\s>/]+)[^>]*?(\/?)>/g)) {
    const [, closing, name = "", selfClosing] = match;
    if (selfClosing === "/") continue;
    if (closing !== "/") {
      stack.push(name);
      continue;
    }
    const open = stack.pop();
    if (open !== name) return `unexpected </${name}>`;
  }
  const unclosed = stack.at(-1);
  if (unclosed !== undefined) return `unclosed <${unclosed}>`;
  return stack.length === 0 && /<[^!?]/.test(stripped) ? undefined : "no root element";
}

async function getXml(
  fetchFunction: FetchFunction,
  url: string,
  encoding: string | undefined,
): Promise<Outcome<unknown>> {
  let response: Response;
  try {
    response = await fetchFunction(url, {
      headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, error: `network error for ${url}: ${errorMessage(error)}` };
  }
  if (response.status === 429) return { ok: false, error: `HTTP 429 rate limited by ${url}` };
  if (!response.ok) return { ok: false, error: `HTTP ${response.status} from ${url}` };
  let content: Outcome<Uint8Array>;
  try {
    content = await readCapped(response, url);
  } catch (error) {
    return { ok: false, error: `cannot read ${url}: ${errorMessage(error)}` };
  }
  if (!content.ok) return content;
  const decoded = decode(content.value, encoding);
  if (!decoded.ok) return decoded;
  const problem = balanceError(decoded.value);
  if (problem !== undefined) return { ok: false, error: `invalid XML from ${url}: ${problem}` };
  try {
    return { ok: true, value: parser.parse(decoded.value) };
  } catch (error) {
    return { ok: false, error: `invalid XML from ${url}: ${errorMessage(error)}` };
  }
}

function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.filter(isObject);
  return isObject(value) ? [value] : [];
}

function findNodes(root: unknown, tag: string, depth = ROOT_SEARCH_DEPTH): Node[] | undefined {
  if (!isObject(root) || depth < 0) return undefined;
  if (tag in root) return nodes(root[tag]);
  for (const child of Object.values(root)) {
    for (const candidate of Array.isArray(child) ? child : [child]) {
      const found = findNodes(candidate, tag, depth - 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function leaf(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return text(String(value));
  if (isObject(value)) return leaf(value["#text"]);
  if (Array.isArray(value)) return value.map(leaf).find((entry) => entry !== undefined);
  return undefined;
}

function pick(row: Node, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = leaf(row[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function plain(value: string | undefined): string | undefined {
  return value === undefined ? undefined : text(stripHtml(value.replace(/&nbsp;/g, " ")));
}

function absolute(link: string | undefined, base: string): string | undefined {
  if (link === undefined) return undefined;
  try {
    return new URL(link, base).toString();
  } catch {
    return undefined;
  }
}

function atomLink(row: Node): string | undefined {
  const links = nodes(row["link"]);
  const preferred = links.find(
    (link) => link["@_rel"] === undefined || link["@_rel"] === "alternate",
  );
  return leaf(preferred?.["@_href"]) ?? leaf(links[0]?.["@_href"]);
}

function linkOf(row: Node): string | undefined {
  return atomLink(row) ?? pick(row, ["link", "url", "guid"]);
}

function authorOf(row: Node): string | undefined {
  const author = row["author"];
  const named = isObject(author) ? leaf(author["name"]) : undefined;
  return pick(row, ["company", "employer", "dc:creator"]) ?? named ?? leaf(author);
}

function splitCompany(
  rawTitle: string,
  company: string | undefined,
): { readonly title: string; readonly company: string | undefined } {
  const separator = rawTitle.indexOf(": ");
  if (separator <= 0 || separator > MAX_COMPANY_PREFIX) return { title: rawTitle, company };
  const prefix = rawTitle.slice(0, separator).trim();
  const rest = rawTitle.slice(separator + 2).trim();
  if (rest === "") return { title: rawTitle, company };
  if (company === undefined) return { title: rest, company: prefix };
  return prefix.toLowerCase() === company.toLowerCase()
    ? { title: rest, company }
    : { title: rawTitle, company };
}

function filtered(mapped: Mapped, query: SourceQuery): Mapped {
  return {
    ...mapped,
    postings: mapped.postings.filter((posting) => matchesKeywords(posting, query.keywords)),
  };
}

function collect(
  rows: readonly Node[],
  label: string,
  mapper: (row: Node) => Posting | undefined,
): Mapped {
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

function feedItems(document: unknown): Node[] | undefined {
  if (!isObject(document)) return undefined;
  const rss = document["rss"];
  const channel = isObject(rss) ? rss["channel"] : undefined;
  if (isObject(channel)) return nodes(channel["item"]);
  const atom = document["feed"];
  if (isObject(atom)) return nodes(atom["entry"]);
  const rdf = document["rdf:RDF"];
  if (isObject(rdf)) return nodes(rdf["item"]);
  return findNodes(document, "item");
}

function mapFeedItem(row: Node, options: FeedOptions): Posting | undefined {
  const rawTitle = plain(pick(row, ["title"]));
  const url = absolute(linkOf(row), options.endpoint);
  if (rawTitle === undefined || url === undefined) return undefined;
  const { title, company } = splitCompany(rawTitle, plain(authorOf(row)));
  const key = pick(row, ["guid", "id"]) ?? url;
  const description = plain(pick(row, ["content:encoded", "description", "summary", "content"]));
  return withOptional(
    { id: `${options.id}:${key}`, source: options.id, url, company: company ?? "unknown", title },
    {
      description,
      postedAt: isoDate(pick(row, ["pubDate", "published", "dc:date", "updated", "date"])),
    },
  );
}

function failed(message: string): SourceResult {
  return { postings: [], errors: [message], warnings: [] };
}

function xmlAdapter(
  fetchFunction: FetchFunction,
  options: FeedOptions,
  extract: (document: unknown) => Node[] | undefined,
  mapper: (row: Node) => Posting | undefined,
  emptyMessage: string,
): SourceAdapter {
  return {
    name: options.id,
    async fetch(query) {
      const outcome = await getXml(fetchFunction, options.endpoint, options.encoding);
      if (!outcome.ok) return failed(`${options.id}: ${outcome.error}`);
      const rows = extract(outcome.value);
      if (rows === undefined) return failed(`${options.id}: ${emptyMessage}`);
      const mapped = filtered(collect(rows, "feed", mapper), query);
      return { postings: mapped.postings, errors: [], warnings: mapped.warnings };
    },
  };
}

/**
 * Builds an adapter for an RSS 2.0, RSS 1.0 or Atom feed. `encoding` overrides the
 * charset declared in the XML prolog (for example `iso-8859-1`).
 */
export function createFeedAdapter(
  fetchFunction: FetchFunction,
  options: FeedOptions,
): SourceAdapter {
  return xmlAdapter(
    fetchFunction,
    options,
    feedItems,
    (row) => mapFeedItem(row, options),
    "not an RSS or Atom feed",
  );
}

function locationOf(row: Node, keys: readonly string[]): string | undefined {
  const parts = keys.map((key) => plain(pick(row, [key]))).filter((part) => part !== undefined);
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return unique.length === 0 ? undefined : unique.join(", ");
}

function mapJobFeedRow(row: Node, options: XmlFeedOptions): Posting | undefined {
  const title = plain(pick(row, ["title", "name"]));
  const url = absolute(pick(row, ["url", "link", "apply_url"]), options.endpoint);
  if (title === undefined || url === undefined) return undefined;
  const id = pick(row, ["id", "jobid", "referencenumber"]) ?? url;
  const stated = plain(pick(row, ["location"]));
  const location = locationOf(row, ["city", "region", "country"]) ?? stated;
  const remote = stated !== undefined && /\bremote\b/i.test(stated) ? true : undefined;
  return withOptional(
    {
      id: `${options.id}:${id}`,
      source: options.id,
      url,
      company: plain(pick(row, ["company", "employer"])) ?? "unknown",
      title,
    },
    {
      location: stated !== undefined && location !== stated ? `${location}, ${stated}` : location,
      remote,
      contract: plain(pick(row, ["jobtype", "job_type", "type"])),
      description: plain(pick(row, ["description", "summary"])),
      postedAt: isoDate(pick(row, ["date", "pubdate", "published", "posted"])),
    },
  );
}

/**
 * Builds an adapter for `{domain}/job_feed.xml` feeds whose `<job>` elements carry
 * title, company, url, country, region, city, jobtype and location fields.
 */
export function createJobFeedXmlAdapter(
  fetchFunction: FetchFunction,
  options: XmlFeedOptions,
): SourceAdapter {
  return xmlAdapter(
    fetchFunction,
    options,
    (document) => findNodes(document, "job"),
    (row) => mapJobFeedRow(row, options),
    "not a job_feed.xml document, no <job> elements found",
  );
}

function mapNhsRow(row: Node, options: XmlFeedOptions): Posting | undefined {
  const title = plain(pick(row, ["title", "jobTitle"]));
  const url = absolute(pick(row, ["url", "link"]), options.endpoint);
  if (title === undefined || url === undefined) return undefined;
  const id = pick(row, ["id", "reference", "jobReference"]) ?? url;
  return withOptional(
    {
      id: `${options.id}:${id}`,
      source: options.id,
      url,
      company: plain(pick(row, ["employer", "employerName", "organisation"])) ?? "unknown",
      title,
    },
    {
      location: locationOf(row, ["town", "location", "county"]),
      contract: plain(pick(row, ["jobType", "contractType", "contract"])),
      description: plain(pick(row, ["description", "summary"])),
      postedAt: isoDate(pick(row, ["publicationDate", "datePosted", "postedDate", "date"])),
    },
  );
}

/**
 * Builds an adapter for the NHS Jobs `search_xml` API, whose `<vacancyDetails>`
 * elements carry id, title, employer, url, town, jobType and publicationDate.
 */
export function createNhsXmlAdapter(
  fetchFunction: FetchFunction,
  options: XmlFeedOptions,
): SourceAdapter {
  return xmlAdapter(
    fetchFunction,
    options,
    (document) => findNodes(document, "vacancyDetails"),
    (row) => mapNhsRow(row, options),
    "not an NHS search_xml document, no <vacancyDetails> elements found",
  );
}
