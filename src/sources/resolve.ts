import type { DataDir, Profile, Result, SourceAdapter } from "../core/types.ts";
import { createAtsAdapters } from "./ats.ts";
import { createApiBoardAdapters, type ApiBoardName, type ApiEndpoints } from "./boards-api.ts";
import { createBoardAdapters, type BoardEndpoints } from "./boards.ts";
import { loadCatalog, matchesProfile, type Board, type LoadCatalogOptions } from "./catalog.ts";
import { readCustomBoards } from "./custom-boards.ts";
import {
  createFeedAdapter,
  createJobFeedXmlAdapter,
  createNhsXmlAdapter,
  type FeedOptions,
} from "./feed.ts";
import type { FetchFunction } from "./http.ts";

const API_BOARD_NAMES: readonly ApiBoardName[] = [
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
];

export type ResolveOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: FetchFunction;
  readonly catalog?: LoadCatalogOptions;
};

/**
 * One entry of the resolved Source set. `id` is the report label (`id` or `id:option`).
 * `adapter` is absent for browser and manual boards and when `problem` explains why the
 * name could not be resolved.
 */
export type ResolvedBoard = {
  readonly id: string;
  readonly board?: Board;
  readonly option?: string;
  readonly adapter?: SourceAdapter;
  readonly minIntervalMinutes?: number;
  readonly problem?: string;
};

function isApiBoardName(name: string): name is ApiBoardName {
  return (API_BOARD_NAMES as readonly string[]).includes(name);
}

function isOptionBoardName(name: string): name is keyof BoardEndpoints {
  return name === "getonboard" || name === "himalayas";
}

function defaultValue(board: Board, name: string): string {
  const options = board.options ?? {};
  const allowed = options[name] ?? [];
  return (options["default"] ?? []).find((value) => allowed.includes(value)) ?? "";
}

function optionKey(board: Board, option: string): string | undefined {
  return Object.entries(board.options ?? {}).find(
    ([name, values]) => name !== "default" && values.includes(option),
  )?.[0];
}

function endpointFor(board: Board, option: string | undefined): Result<string> {
  const template = option === undefined ? board.endpoint : (board.optionEndpoint ?? board.endpoint);
  if (template === undefined) {
    return { ok: false, error: { code: "usage", message: `${board.id} has no endpoint` } };
  }
  if (option !== undefined && board.options === undefined) {
    return {
      ok: false,
      error: { code: "usage", message: `${board.id}: this board does not support options` },
    };
  }
  const key = option === undefined ? undefined : optionKey(board, option);
  if (option !== undefined && key === undefined) {
    return {
      ok: false,
      error: { code: "usage", message: `${board.id}: "${option}" is not an option of this board` },
    };
  }
  const filled = template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    encodeURIComponent(name === key && option !== undefined ? option : defaultValue(board, name)),
  );
  return { ok: true, value: filled };
}

function xmlAdapter(
  board: Board,
  endpoint: string,
  fetchFunction: FetchFunction,
): SourceAdapter | undefined {
  const options: FeedOptions = { id: board.id, endpoint };
  if (board.parser === "rss") return createFeedAdapter(fetchFunction, options);
  if (board.parser === "job-feed-xml") return createJobFeedXmlAdapter(fetchFunction, options);
  if (board.parser === "nhs-xml") return createNhsXmlAdapter(fetchFunction, options);
  return undefined;
}

function apiAdapter(
  board: Board,
  endpoint: string,
  option: string | undefined,
  fetchFunction: FetchFunction,
  registered: ReadonlyMap<string, SourceAdapter>,
): SourceAdapter | string {
  const parser = board.parser ?? "";
  if (isApiBoardName(parser)) {
    const endpoints: ApiEndpoints = option === undefined ? {} : { [parser]: endpoint };
    const found = createApiBoardAdapters(fetchFunction, endpoints).find(
      (adapter) => adapter.name === parser,
    );
    if (found !== undefined) return found;
  }
  if (option !== undefined && isOptionBoardName(parser)) {
    const endpoints: BoardEndpoints = { [parser]: endpoint };
    const optioned = createBoardAdapters(fetchFunction, endpoints).find(
      (adapter) => adapter.name === parser,
    );
    if (optioned !== undefined) return optioned;
  }
  const found = registered.get(parser);
  if (found === undefined) return `${board.id}: no adapter for parser "${parser}"`;
  if (option !== undefined) return `${board.id}: this board does not support options`;
  return found;
}

function build(
  board: Board,
  option: string | undefined,
  fetchFunction: FetchFunction,
  registered: ReadonlyMap<string, SourceAdapter>,
): ResolvedBoard {
  const id = option === undefined ? board.id : `${board.id}:${option}`;
  const base = {
    id,
    board,
    ...(option === undefined ? {} : { option }),
    ...(board.minIntervalMinutes === undefined
      ? {}
      : { minIntervalMinutes: board.minIntervalMinutes }),
  };
  if (board.access !== "feed") return base;
  const endpoint = endpointFor(board, option);
  if (!endpoint.ok) return { ...base, problem: endpoint.error.message };
  const adapter =
    xmlAdapter(board, endpoint.value, fetchFunction) ??
    apiAdapter(board, endpoint.value, option, fetchFunction, registered);
  if (typeof adapter === "string") return { ...base, problem: adapter };
  return { ...base, adapter };
}

function registeredAdapters(fetchFunction: FetchFunction): Map<string, SourceAdapter> {
  const adapters = [...createAtsAdapters(fetchFunction), ...createBoardAdapters(fetchFunction)];
  return new Map(adapters.map((adapter) => [adapter.name, adapter]));
}

function splitSpec(spec: string): { readonly id: string; readonly option: string | undefined } {
  const cut = spec.indexOf(":");
  if (cut < 0) return { id: spec, option: undefined };
  return { id: spec.slice(0, cut), option: spec.slice(cut + 1) };
}

function resolveExplicit(
  specs: readonly string[],
  boards: ReadonlyMap<string, Board>,
  fetchFunction: FetchFunction,
  registered: ReadonlyMap<string, SourceAdapter>,
): ResolvedBoard[] {
  return [...new Set(specs)].map((spec) => {
    const { id, option } = splitSpec(spec);
    const board = boards.get(id);
    if (board !== undefined) return build(board, option, fetchFunction, registered);
    const adapter = registered.get(id);
    if (adapter === undefined) return { id: spec, problem: `${spec}: unknown source` };
    if (option !== undefined) {
      return { id: spec, problem: `${spec}: this source does not support options` };
    }
    return { id, adapter };
  });
}

/**
 * Resolves the Profile `sources` into the Sources a sweep runs. An empty list selects every
 * catalog `feed` board that matches the Profile `regions` and `remote`, plus every custom
 * board in the data dir. An explicit list is used as given: each entry is a board id, an
 * `id:option` pair or an existing Source name such as `greenhouse`. Names that cannot be
 * resolved come back with a `problem` instead of failing the whole set.
 */
export async function resolveBoards(
  profile: Profile,
  dir: DataDir,
  options: ResolveOptions = {},
): Promise<Result<ResolvedBoard[]>> {
  const fetchFunction: FetchFunction = options.fetch ?? ((input, init) => fetch(input, init));
  const catalog = await loadCatalog({
    ...(options.env === undefined ? {} : { env: options.env }),
    ...options.catalog,
  });
  if (!catalog.ok) return catalog;
  const custom = await readCustomBoards(dir.path);
  if (!custom.ok) return custom;
  const registered = registeredAdapters(fetchFunction);
  if (profile.sources.length === 0) {
    const selected = [
      ...catalog.value.boards.filter(
        (board) => board.access === "feed" && matchesProfile(board, profile),
      ),
      ...custom.value.filter(
        (board) => !catalog.value.boards.some((known) => known.id === board.id),
      ),
    ];
    return {
      ok: true,
      value: selected.map((board) => build(board, undefined, fetchFunction, registered)),
    };
  }
  const known = new Map(
    [...custom.value, ...catalog.value.boards].map((board) => [board.id, board]),
  );
  return {
    ok: true,
    value: resolveExplicit(profile.sources, known, fetchFunction, registered),
  };
}
