import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import bundledCatalog from "../../catalog/boards.json" with { type: "json" };
import { PRODUCT_NAME, settingValue } from "../core/env.ts";
import { errorMessage } from "../core/narrow.ts";
import { readCapped } from "./http.ts";
import { writeAtomic } from "../core/fs.ts";
import type { Profile, Result } from "../core/types.ts";

const BOARD_ACCESS = ["feed", "browser", "manual"] as const;
type BoardAccess = (typeof BOARD_ACCESS)[number];

const BOARD_WORK_MODES = ["remote", "hybrid", "onsite"] as const;
type BoardWorkMode = (typeof BOARD_WORK_MODES)[number];

const BOARD_JOB_TYPES = ["tech", "general", "public-sector"] as const;
type BoardJobType = (typeof BOARD_JOB_TYPES)[number];

const BOARD_REGIONS = [
  "global",
  "EU",
  "LATAM",
  "US",
  "UK",
  "DE",
  "ES",
  "CH",
  "NL",
  "PT",
  "PL",
  "JP",
  "APAC",
  "Africa",
  "SE",
  "NO",
  "CA",
  "AU",
  "IN",
  "SG",
  "BR",
  "MX",
  "AR",
  "CL",
  "CO",
  "PE",
  "IE",
  "FR",
  "IT",
  "NG",
  "KE",
  "ZA",
] as const;

/** Parsers the adapters register. A `feed` board must name one of these. */
const KNOWN_PARSERS = [
  "rss",
  "job-feed-xml",
  "nhs-xml",
  "remoteok",
  "himalayas",
  "getonboard",
  "hn",
  "remotive",
  "jobicy",
  "arbeitnow",
  "workingnomads",
  "hnjobs",
  "jobtech",
  "mycareersfuture",
  "bundesagentur",
  "eures",
  "cbop",
] as const;

/** One job board in the catalog. Only `feed` boards carry a `parser` and an `endpoint`. */
export type Board = {
  readonly id: string;
  readonly name: string;
  readonly homepage: string;
  readonly access: BoardAccess;
  readonly regions: readonly string[];
  readonly workModes: readonly BoardWorkMode[];
  readonly jobTypes: readonly BoardJobType[];
  readonly stability?: "unofficial";
  readonly parser?: string;
  readonly endpoint?: string;
  /** Endpoint used instead of `endpoint` when the Profile picks an option with `id:option`. */
  readonly optionEndpoint?: string;
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /** Named option values; the `default` key lists the values used when none is chosen. */
  readonly options?: Readonly<Record<string, readonly string[]>>;
  readonly minIntervalMinutes?: number;
  readonly attribution?: string;
};

type CatalogOrigin = "cache" | "remote" | "bundled";

/** The boards a load produced, where they came from, and any non-fatal problems. */
export type Catalog = {
  readonly boards: readonly Board[];
  readonly origin: CatalogOrigin;
  readonly warnings: readonly string[];
};

export type LoadCatalogOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchText?: (url: string) => Promise<string>;
  readonly now?: () => number;
  readonly bundled?: unknown;
};

const DEFAULT_CATALOG_URL =
  "https://raw.githubusercontent.com/andryorelabs/jobship/main/catalog/boards.json";
const CACHE_FILE = "boards.json";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_CATALOG_BYTES = 2_000_000;

const EU_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
];
const LATAM_COUNTRIES = [
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "SV",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PY",
  "PE",
  "UY",
  "VE",
];
const APAC_COUNTRIES = [
  "AU",
  "CN",
  "HK",
  "ID",
  "IN",
  "JP",
  "KR",
  "MY",
  "NZ",
  "PH",
  "SG",
  "TH",
  "TW",
  "VN",
  "BD",
  "PK",
  "LK",
];
const AFRICA_COUNTRIES = [
  "NG",
  "KE",
  "ZA",
  "EG",
  "GH",
  "MA",
  "TN",
  "ET",
  "TZ",
  "UG",
  "RW",
  "SN",
  "CI",
  "DZ",
];

const REGION_GROUPS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["eu", new Set(EU_COUNTRIES.map((code) => code.toLowerCase()))],
  ["latam", new Set(LATAM_COUNTRIES.map((code) => code.toLowerCase()))],
  ["apac", new Set(APAC_COUNTRIES.map((code) => code.toLowerCase()))],
  ["africa", new Set(AFRICA_COUNTRIES.map((code) => code.toLowerCase()))],
]);

type ParseMode = "bundled" | "remote";
type Parsed = { readonly boards: Board[]; readonly warnings: string[] };

function invalid(message: string): Result<never> {
  return { ok: false, error: { code: "catalog-invalid", message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateEnumList(
  list: unknown,
  allowed: readonly string[],
  field: string,
): string | undefined {
  if (!isStringArray(list) || list.length === 0) return `${field} must be a non-empty array`;
  const unknownValue = list.find((item) => !allowed.includes(item));
  return unknownValue === undefined ? undefined : `unknown ${field} value "${unknownValue}"`;
}

function validateOptions(options: unknown, entry: Record<string, unknown>): string | undefined {
  const declared = options ?? {};
  if (!isRecord(declared) || !Object.values(declared).every(isStringArray)) {
    return "options must map names to string arrays";
  }
  const templates = [entry["endpoint"], entry["optionEndpoint"]].filter(isString);
  for (const template of templates) {
    for (const match of template.matchAll(/\{(\w+)\}/g)) {
      const name = match[1] ?? "";
      if (!(name in declared)) return `endpoint placeholder {${name}} has no option`;
    }
  }
  return undefined;
}

function validateFeedFields(entry: Record<string, unknown>, mode: ParseMode): string | undefined {
  if (!isString(entry["endpoint"])) return "feed entry needs an endpoint";
  if (!isString(entry["parser"])) return "feed entry needs a parser";
  const method = entry["method"];
  if (method !== undefined && method !== "GET" && method !== "POST") {
    return `unknown method ${JSON.stringify(method)}`;
  }
  const headers = entry["headers"];
  if (
    headers !== undefined &&
    !(isRecord(headers) && Object.values(headers).every((value) => typeof value === "string"))
  ) {
    return "headers must map names to strings";
  }
  return mode === "bundled" && !(KNOWN_PARSERS as readonly string[]).includes(entry["parser"])
    ? `unknown parser "${entry["parser"]}"`
    : undefined;
}

function validateEntry(entry: Record<string, unknown>, mode: ParseMode): string | undefined {
  for (const field of ["id", "name", "homepage"]) {
    if (!isString(entry[field])) return `${field} must be a non-empty string`;
  }
  const access = entry["access"];
  if (!(BOARD_ACCESS as readonly unknown[]).includes(access)) {
    return `unknown access "${String(access)}"`;
  }
  const listProblem =
    validateEnumList(entry["regions"], BOARD_REGIONS, "region") ??
    validateEnumList(entry["workModes"], BOARD_WORK_MODES, "work mode") ??
    validateEnumList(entry["jobTypes"], BOARD_JOB_TYPES, "job type");
  if (listProblem !== undefined) return listProblem;
  const stability = entry["stability"];
  if (stability !== undefined && stability !== "unofficial") {
    return `unknown stability ${JSON.stringify(stability)}`;
  }
  const interval = entry["minIntervalMinutes"];
  if (interval !== undefined && !(typeof interval === "number" && interval > 0)) {
    return "minIntervalMinutes must be a positive number";
  }
  return (
    validateOptions(entry["options"], entry) ??
    (access === "feed" ? validateFeedFields(entry, mode) : undefined)
  );
}

function isUnknownRemoteParser(entry: Record<string, unknown>): boolean {
  return (
    entry["access"] === "feed" &&
    isString(entry["parser"]) &&
    !(KNOWN_PARSERS as readonly string[]).includes(entry["parser"])
  );
}

function describeEntry(entry: unknown, index: number): string {
  const id = isRecord(entry) ? entry["id"] : undefined;
  return isString(id) ? `"${id}"` : `#${index}`;
}

function narrowList<T extends string>(list: unknown, allowed: readonly T[]): T[] {
  const values = isStringArray(list) ? list : [];
  return allowed.filter((candidate) => values.includes(candidate));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((pair): pair is [string, string] => typeof pair[1] === "string"),
  );
}

function toOptions(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((pair): pair is [string, string[]] => isStringArray(pair[1])),
  );
}

function toBoard(entry: Record<string, unknown>): Board {
  const access = BOARD_ACCESS.find((candidate) => candidate === entry["access"]) ?? "manual";
  const method =
    entry["method"] === "POST" ? "POST" : entry["method"] === "GET" ? "GET" : undefined;
  const interval = entry["minIntervalMinutes"];
  return {
    id: optionalString(entry["id"]) ?? "",
    name: optionalString(entry["name"]) ?? "",
    homepage: optionalString(entry["homepage"]) ?? "",
    access,
    regions: narrowList(entry["regions"], BOARD_REGIONS),
    workModes: narrowList(entry["workModes"], BOARD_WORK_MODES),
    jobTypes: narrowList(entry["jobTypes"], BOARD_JOB_TYPES),
    ...(entry["stability"] === "unofficial" ? { stability: "unofficial" as const } : {}),
    ...(typeof entry["parser"] === "string" ? { parser: entry["parser"] } : {}),
    ...(typeof entry["endpoint"] === "string" ? { endpoint: entry["endpoint"] } : {}),
    ...(typeof entry["optionEndpoint"] === "string"
      ? { optionEndpoint: entry["optionEndpoint"] }
      : {}),
    ...(method === undefined ? {} : { method }),
    ...(entry["headers"] === undefined ? {} : { headers: toStringRecord(entry["headers"]) }),
    ...(entry["body"] === undefined ? {} : { body: entry["body"] }),
    ...(entry["options"] === undefined ? {} : { options: toOptions(entry["options"]) }),
    ...(typeof interval === "number" ? { minIntervalMinutes: interval } : {}),
    ...(typeof entry["attribution"] === "string" ? { attribution: entry["attribution"] } : {}),
  };
}

function parseCatalog(raw: unknown, mode: ParseMode): Result<Parsed> {
  if (!Array.isArray(raw)) return invalid("catalog must be an array of boards");
  const boards: Board[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of raw.entries()) {
    const label = describeEntry(entry, index);
    if (!isRecord(entry)) return invalid(`entry ${label}: must be an object`);
    if (mode === "remote" && isUnknownRemoteParser(entry)) {
      warnings.push(`skipped entry ${label}: unknown parser "${String(entry["parser"])}"`);
      continue;
    }
    const problem = validateEntry(entry, mode);
    if (problem !== undefined) return invalid(`entry ${label}: ${problem}`);
    const id = String(entry["id"]);
    if (seen.has(id)) return invalid(`entry ${label}: duplicate id`);
    seen.add(id);
    boards.push(toBoard(entry));
  }
  return { ok: true, value: { boards, warnings } };
}

function parseText(text: string, mode: ParseMode): Result<Parsed> {
  if (text.length > MAX_CATALOG_BYTES) return invalid("catalog is too large");
  try {
    return parseCatalog(JSON.parse(text) as unknown, mode);
  } catch (error) {
    return invalid(`catalog is not valid JSON: ${errorMessage(error)}`);
  }
}

function cacheFilePath(env: Readonly<Record<string, string | undefined>>): string {
  const override = settingValue(env, "CACHE_DIR");
  if (override !== undefined) return path.join(override, CACHE_FILE);
  const xdg = env["XDG_CACHE_HOME"];
  const root =
    xdg !== undefined && xdg !== "" ? xdg : path.join(env["HOME"] ?? os.homedir(), ".cache");
  return path.join(root, PRODUCT_NAME, CACHE_FILE);
}

function cacheSourcePath(file: string): string {
  return `${file}.url`;
}

function readFreshCache(file: string, url: string, now: number): Result<Parsed> | undefined {
  try {
    if (!existsSync(file) || now - statSync(file).mtimeMs >= CACHE_MAX_AGE_MS) return undefined;
    if (readFileSync(cacheSourcePath(file), "utf8").trim() !== url) return undefined;
    return parseText(readFileSync(file, "utf8"), "remote");
  } catch {
    return undefined;
  }
}

async function defaultFetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const content = await readCapped(response, url, MAX_CATALOG_BYTES);
  if (!content.ok) throw new Error(content.error);
  return new TextDecoder().decode(content.value);
}

async function fetchRemote(
  url: string,
  fetchText: (url: string) => Promise<string>,
  cacheFile: string,
): Promise<Result<Parsed>> {
  let text: string;
  try {
    text = await fetchText(url);
  } catch (error) {
    return invalid(`fetch failed: ${errorMessage(error)}`);
  }
  const parsed = parseText(text, "remote");
  if (!parsed.ok) return parsed;
  try {
    writeAtomic(cacheFile, text);
    writeAtomic(cacheSourcePath(cacheFile), url);
  } catch (error) {
    parsed.value.warnings.push(`could not write the catalog cache: ${errorMessage(error)}`);
  }
  return parsed;
}

/**
 * Loads the board catalog. The single entry point for the catalog.
 *
 * Tries a cache under 24 hours old at `<cache dir>/boards.json` that came from the current
 * catalog URL (never with `off`), then the remote copy
 * (`JOBSHIP_CATALOG_URL`, default the `main` copy on GitHub, `off` disables the fetch),
 * then the copy bundled in the binary. The result names the origin used and carries a
 * warning for every skipped remote entry or failed fallback step. Only an invalid bundled
 * catalog fails, with `catalog-invalid`. Tests inject `fetchText`, `now`, `env` and `bundled`.
 */
export async function loadCatalog(options: LoadCatalogOptions = {}): Promise<Result<Catalog>> {
  const env = options.env ?? process.env;
  const now = (options.now ?? Date.now)();
  const cacheFile = cacheFilePath(env);
  const url = settingValue(env, "CATALOG_URL") ?? DEFAULT_CATALOG_URL;
  const cached = url === "off" ? undefined : readFreshCache(cacheFile, url, now);
  if (cached?.ok === true) return { ok: true, value: { ...cached.value, origin: "cache" } };

  const warnings: string[] = [];
  if (url !== "off") {
    const remote = await fetchRemote(url, options.fetchText ?? defaultFetchText, cacheFile);
    if (remote.ok) return { ok: true, value: { ...remote.value, origin: "remote" } };
    warnings.push(`remote catalog unusable, using the bundled copy: ${remote.error.message}`);
  }

  const bundled = parseCatalog(options.bundled ?? bundledCatalog, "bundled");
  if (!bundled.ok) return bundled;
  return {
    ok: true,
    value: { boards: bundled.value.boards, origin: "bundled", warnings },
  };
}

function expandRegion(region: string): ReadonlySet<string> {
  const key = region.toLowerCase();
  return new Set([key, ...(REGION_GROUPS.get(key) ?? [])]);
}

function regionsOverlap(boardRegion: string, profileRegion: string): boolean {
  const board = expandRegion(boardRegion);
  const profile = expandRegion(profileRegion);
  return [...board].some((code) => profile.has(code));
}

function regionMatches(board: Board, profileRegions: readonly string[]): boolean {
  if (profileRegions.length === 0) return true;
  if (board.regions.some((region) => region.toLowerCase() === "global")) return true;
  return profileRegions.some(
    (profileRegion) =>
      profileRegion.toLowerCase() === "global" ||
      board.regions.some((region) => regionsOverlap(region, profileRegion)),
  );
}

function workModeMatches(board: Board, remote: Profile["remote"]): boolean {
  if (remote === "any") return true;
  if (remote === "remote-only") return board.workModes.includes("remote");
  return board.workModes.includes("remote") || board.workModes.includes("hybrid");
}

/**
 * Whether a board suits the Profile. An empty Profile `regions` and a `global` board both
 * match every region; `EU`, `LATAM`, `APAC` and `Africa` match their member countries.
 * `remote-only` needs a `remote` work mode, `hybrid` accepts `remote` or `hybrid`, and
 * `any` accepts every board.
 */
export function matchesProfile(
  board: Board,
  profile: Pick<Profile, "regions" | "remote">,
): boolean {
  return regionMatches(board, profile.regions) && workModeMatches(board, profile.remote);
}
