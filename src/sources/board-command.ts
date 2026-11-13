import type { CommandContext } from "../core/commands.ts";
import { loadProfile } from "../core/data-dir.ts";
import { failure, success, type Envelope } from "../core/envelope.ts";
import { errorMessage } from "../core/narrow.ts";
import type { DataDir } from "../core/types.ts";
import { loadCatalog, type Board, type Catalog } from "./catalog.ts";
import { readCustomBoards, writeCustomBoards } from "./custom-boards.ts";
import { createFeedAdapter } from "./feed.ts";
import type { FetchFunction } from "./http.ts";
import { resolveBoards } from "./resolve.ts";

const USAGE =
  "usage: jobship board add <feed-url> --name <name> [--region <region>]... [--work-mode remote|hybrid|onsite]... | jobship board list | jobship board remove <id>";

const MAX_ID_LENGTH = 60;

type Flags = { readonly values: Map<string, string[]>; readonly positionals: string[] };

function parseFlags(argv: readonly string[]): Flags {
  const values = new Map<string, string[]>();
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    values.set(token, [...(values.get(token) ?? []), argv[index + 1] ?? ""]);
    index += 1;
  }
  return { values, positionals };
}

function dataDirMissing(): Envelope<never> {
  return failure("data-dir-not-found", "board commands need a data directory", {
    recoveryAction:
      "pass --data <dir>, set JOBSHIP_HOME, or run from a directory containing jobship.json",
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID_LENGTH);
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

type Loaded = { readonly catalog: Catalog; readonly custom: Board[] };

async function loadBoards(
  dir: DataDir,
  ctx: CommandContext,
): Promise<{ readonly loaded: Loaded } | { readonly envelope: Envelope<never> }> {
  const catalog = await loadCatalog({ env: ctx.env });
  if (!catalog.ok) return { envelope: failure(catalog.error.code, catalog.error.message) };
  const custom = await readCustomBoards(dir.path);
  if (!custom.ok) return { envelope: failure(custom.error.code, custom.error.message) };
  return { loaded: { catalog: catalog.value, custom: custom.value } };
}

async function checkFeed(
  fetchFunction: FetchFunction,
  id: string,
  url: string,
): Promise<string | null> {
  try {
    const result = await createFeedAdapter(fetchFunction, { id, endpoint: url }).fetch({});
    if (result.errors.length > 0) return result.errors.join("; ");
    if (result.postings.length === 0) return "the feed has no items";
    return null;
  } catch (error) {
    return errorMessage(error);
  }
}

async function runAdd(
  argv: string[],
  ctx: CommandContext,
  fetchFunction: FetchFunction,
): Promise<Envelope<unknown>> {
  const flags = parseFlags(argv);
  const [url] = flags.positionals;
  const name = flags.values.get("--name")?.at(-1);
  if (url === undefined || flags.positionals.length !== 1 || name === undefined || name === "") {
    return failure("usage", USAGE);
  }
  if (ctx.dataDir === null) return dataDirMissing();
  if (!isHttpUrl(url)) return failure("board-invalid", `${url} is not an http(s) URL`);
  const id = slugify(name);
  if (id === "") return failure("board-invalid", "the board name has no letters or digits");
  const current = await loadBoards(ctx.dataDir, ctx);
  if ("envelope" in current) return current.envelope;
  const { catalog, custom } = current.loaded;
  if ([...catalog.boards, ...custom].some((board) => board.id === id)) {
    return failure("board-invalid", `a board with id "${id}" already exists`);
  }
  const problem = await checkFeed(fetchFunction, id, url);
  if (problem !== null) return failure("board-invalid", `${url} is not a usable feed: ${problem}`);
  const candidate = {
    id,
    name,
    homepage: new URL(url).origin,
    access: "feed",
    regions: flags.values.get("--region") ?? ["global"],
    workModes: flags.values.get("--work-mode") ?? ["remote"],
    jobTypes: ["general"],
    parser: "rss",
    endpoint: url,
  };
  const saved = await readCustomBoards(ctx.dataDir.path);
  if (!saved.ok) return failure(saved.error.code, saved.error.message);
  const checked = await loadCatalog({
    env: { JOBSHIP_CATALOG_URL: "off" },
    bundled: [candidate],
  });
  if (!checked.ok) return failure("board-invalid", checked.error.message);
  const [board] = checked.value.boards;
  if (board === undefined) return failure("board-invalid", "the board could not be validated");
  const written = await writeCustomBoards(ctx.dataDir.path, [...saved.value, board]);
  if (!written.ok) return failure(written.error.code, written.error.message);
  return success({ added: true, board });
}

async function activeIds(
  dir: DataDir,
  ctx: CommandContext,
  boards: readonly Board[],
): Promise<ReadonlySet<string>> {
  const profile = loadProfile(dir);
  if (!profile.ok) {
    return new Set(boards.filter((board) => board.access === "feed").map((board) => board.id));
  }
  const resolved = await resolveBoards(profile.value, dir, { env: ctx.env });
  if (!resolved.ok) return new Set<string>();
  return new Set(
    resolved.value.flatMap((entry) =>
      entry.board !== undefined && entry.problem === undefined ? [entry.board.id] : [],
    ),
  );
}

async function runList(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  if (argv.length !== 0) return failure("usage", USAGE);
  if (ctx.dataDir === null) return dataDirMissing();
  const current = await loadBoards(ctx.dataDir, ctx);
  if ("envelope" in current) return current.envelope;
  const { catalog, custom } = current.loaded;
  const customIds = new Set(custom.map((board) => board.id));
  const all = [...custom, ...catalog.boards.filter((board) => !customIds.has(board.id))];
  const active = await activeIds(ctx.dataDir, ctx, all);
  return success({
    origin: catalog.origin,
    warnings: catalog.warnings,
    boards: all.map((board) => ({
      id: board.id,
      name: board.name,
      access: board.access,
      regions: board.regions,
      workModes: board.workModes,
      jobTypes: board.jobTypes,
      custom: customIds.has(board.id),
      active: active.has(board.id),
    })),
  });
}

async function runRemove(argv: string[], ctx: CommandContext): Promise<Envelope<unknown>> {
  const [id] = argv;
  if (id === undefined || argv.length !== 1) return failure("usage", USAGE);
  if (ctx.dataDir === null) return dataDirMissing();
  const custom = await readCustomBoards(ctx.dataDir.path);
  if (!custom.ok) return failure(custom.error.code, custom.error.message);
  if (!custom.value.some((board) => board.id === id)) {
    return failure("not-found", `no custom board "${id}"; catalog boards cannot be removed`);
  }
  const written = await writeCustomBoards(
    ctx.dataDir.path,
    custom.value.filter((board) => board.id !== id),
  );
  if (!written.ok) return failure(written.error.code, written.error.message);
  return success({ removed: id });
}

export function run(
  argv: string[],
  ctx: CommandContext,
  fetchFunction: FetchFunction = (input, init) => fetch(input, init),
): Promise<Envelope<unknown>> {
  const [subcommand, ...rest] = argv;
  if (subcommand === "add") return runAdd(rest, ctx, fetchFunction);
  if (subcommand === "list") return runList(rest, ctx);
  if (subcommand === "remove") return runRemove(rest, ctx);
  return Promise.resolve(failure("usage", USAGE));
}
