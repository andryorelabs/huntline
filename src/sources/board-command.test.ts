import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { isObject } from "../core/narrow.ts";
import { run } from "./board-command.ts";
import type { FetchFunction } from "./http.ts";

const FEED_URL = "https://jobs.example.test/feed.xml";
const FIXTURES = path.join(import.meta.dir, "fixtures", "feed");

let root = "";

function context(): CommandContext {
  return { dataDir: { path: root }, env: { JOBSHIP_CATALOG_URL: "off" }, cwd: root };
}

function serving(fixture: string): FetchFunction {
  return () => Promise.resolve(new Response(readFileSync(path.join(FIXTURES, fixture))));
}

function errorCode(envelope: Awaited<ReturnType<typeof run>>): string | null {
  return envelope.ok ? null : envelope.error.code;
}

type ListedBoard = { id: string; access: string; active: boolean; custom: boolean };

function listedBoards(envelope: Awaited<ReturnType<typeof run>>): ListedBoard[] {
  if (!envelope.ok) return [];
  const data = envelope.data;
  if (!isObject(data) || !Array.isArray(data["boards"])) return [];
  return data["boards"].filter(isObject).map((entry) => ({
    id: String(entry["id"]),
    access: String(entry["access"]),
    active: entry["active"] === true,
    custom: entry["custom"] === true,
  }));
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jobship-board-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("board add", () => {
  test("saves a feed board that list then shows as active", async () => {
    const added = await run(
      ["add", FEED_URL, "--name", "Example Jobs", "--region", "LATAM", "--work-mode", "remote"],
      context(),
      serving("rss.xml"),
    );
    expect(added.ok).toBe(true);
    expect(existsSync(path.join(root, "boards.json"))).toBe(true);
    const board = listedBoards(await run(["list"], context())).find(
      (entry) => entry.id === "example-jobs",
    );
    expect(board).toMatchObject({ access: "feed", active: true, custom: true });
  });

  test("rejects an HTML page with board-invalid", async () => {
    const result = await run(
      ["add", FEED_URL, "--name", "Page"],
      context(),
      serving("not-a-feed.html"),
    );
    expect(errorCode(result)).toBe("board-invalid");
    expect(existsSync(path.join(root, "boards.json"))).toBe(false);
  });

  test("rejects an unknown region with board-invalid", async () => {
    const result = await run(
      ["add", FEED_URL, "--name", "Odd", "--region", "Atlantis"],
      context(),
      serving("rss.xml"),
    );
    expect(errorCode(result)).toBe("board-invalid");
  });

  test("rejects a duplicate id and a missing name", async () => {
    await run(["add", FEED_URL, "--name", "Dup"], context(), serving("rss.xml"));
    const again = await run(["add", FEED_URL, "--name", "Dup"], context(), serving("rss.xml"));
    expect(errorCode(again)).toBe("board-invalid");
    expect(errorCode(await run(["add", FEED_URL], context(), serving("rss.xml")))).toBe("usage");
  });
});

describe("board list", () => {
  test("includes catalog boards", async () => {
    const boards = listedBoards(await run(["list"], context()));
    expect(boards.some((entry) => entry.id === "wellfound" && entry.access === "browser")).toBe(
      true,
    );
  });
});

describe("board remove", () => {
  test("deletes a custom board", async () => {
    await run(["add", FEED_URL, "--name", "Gone"], context(), serving("rss.xml"));
    const removed = await run(["remove", "gone"], context());
    expect(removed).toEqual({ ok: true, data: { removed: "gone" } });
    const ids = listedBoards(await run(["list"], context())).map((entry) => entry.id);
    expect(ids).not.toContain("gone");
  });

  test("fails not-found for a catalog id and an unknown id", async () => {
    expect(errorCode(await run(["remove", "wellfound"], context()))).toBe("not-found");
    expect(errorCode(await run(["remove", "nope"], context()))).toBe("not-found");
  });
});

describe("board usage", () => {
  test("fails usage on an unknown subcommand and without a data dir", async () => {
    expect(errorCode(await run(["bogus"], context()))).toBe("usage");
    const noDir: CommandContext = { dataDir: null, env: {}, cwd: root };
    expect(errorCode(await run(["list"], noDir))).toBe("data-dir-not-found");
  });
});
