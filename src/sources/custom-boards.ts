import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { withLock, writeAtomic } from "../core/fs.ts";
import { errorMessage } from "../core/narrow.ts";
import type { Result } from "../core/types.ts";
import { loadCatalog, type Board } from "./catalog.ts";

const CUSTOM_BOARDS_FILE = "boards.json";

function invalid(message: string): Result<never> {
  return { ok: false, error: { code: "custom-boards-invalid", message } };
}

function feedProblem(board: Board): string | undefined {
  if (board.access !== "feed") return `custom board "${board.id}" must have access "feed"`;
  if (board.parser !== "rss") return `custom board "${board.id}" must use the rss parser`;
  return undefined;
}

async function validate(raw: unknown): Promise<Result<Board[]>> {
  const loaded = await loadCatalog({ env: { JOBSHIP_CATALOG_URL: "off" }, bundled: raw });
  if (!loaded.ok) return invalid(loaded.error.message);
  const problem = loaded.value.boards.map(feedProblem).find((entry) => entry !== undefined);
  if (problem !== undefined) return invalid(problem);
  return { ok: true, value: [...loaded.value.boards] };
}

/**
 * Reads the custom RSS/Atom boards saved in `<dir>/boards.json`. A missing file is an empty
 * list. Every entry is checked with the catalog loader's rules and must be a `feed` board
 * with the `rss` parser; anything else fails `custom-boards-invalid`.
 */
export async function readCustomBoards(dir: string): Promise<Result<Board[]>> {
  const file = path.join(dir, CUSTOM_BOARDS_FILE);
  if (!existsSync(file)) return { ok: true, value: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return invalid(`${CUSTOM_BOARDS_FILE} is not valid JSON: ${errorMessage(error)}`);
  }
  const checked = await validate(parsed);
  if (checked.ok) return checked;
  return invalid(`${CUSTOM_BOARDS_FILE}: ${checked.error.message}`);
}

/** Replaces `<dir>/boards.json` with the given boards, atomically and under the data-dir lock. */
export async function writeCustomBoards(
  dir: string,
  boards: readonly Board[],
): Promise<Result<void>> {
  try {
    await withLock(dir, () => {
      writeAtomic(path.join(dir, CUSTOM_BOARDS_FILE), `${JSON.stringify(boards, null, 2)}\n`);
      return Promise.resolve();
    });
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: { code: "custom-boards-write-failed", message: errorMessage(error) },
    };
  }
}
