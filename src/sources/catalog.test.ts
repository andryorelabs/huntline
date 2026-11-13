import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Board, loadCatalog, matchesProfile } from "./catalog.ts";

let cacheDir: string;
let env: Record<string, string>;

beforeEach(() => {
  cacheDir = mkdtempSync(path.join(tmpdir(), "jobship-catalog-"));
  env = { JOBSHIP_CACHE_DIR: cacheDir };
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

const neverFetch = (): Promise<string> => Promise.reject(new Error("network is off"));

function board(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "demo",
    name: "Demo",
    homepage: "https://example.com",
    access: "manual",
    regions: ["global"],
    workModes: ["remote"],
    jobTypes: ["tech"],
    ...extra,
  };
}

const feedBoard = (extra: Record<string, unknown> = {}): Record<string, unknown> =>
  board({
    access: "feed",
    parser: "rss",
    endpoint: "https://example.com/feed.xml",
    ...extra,
  });

async function loadBundled(bundled: unknown) {
  return loadCatalog({ env: { ...env, JOBSHIP_CATALOG_URL: "off" }, bundled });
}

describe("bundled catalog", () => {
  test("has at least 100 boards, 30 feeds, wellfound and bundesagentur", async () => {
    const result = await loadCatalog({
      env: { ...env, JOBSHIP_CATALOG_URL: "off" },
      fetchText: neverFetch,
    });
    if (!result.ok) throw new Error(result.error.message);
    const { boards, origin } = result.value;
    expect(origin).toBe("bundled");
    expect(boards.length).toBeGreaterThanOrEqual(100);
    expect(boards.filter((entry) => entry.access === "feed").length).toBeGreaterThanOrEqual(30);
    expect(boards.find((entry) => entry.id === "wellfound")?.access).toBe("browser");
    expect(boards.find((entry) => entry.id === "bundesagentur")?.workModes).toContain("onsite");
    expect(boards.find((entry) => entry.id === "trampos")?.access).toBe("manual");
    expect(boards.find((entry) => entry.id === "jobbank")?.access).toBe("manual");
  });
});

describe("validation", () => {
  test.each([
    ["an unknown access", board({ access: "paid" }), "demo"],
    ["an unknown region", board({ regions: ["Atlantis"] }), "Atlantis"],
    ["an unknown work mode", board({ workModes: ["office"] }), "office"],
    ["an unknown job type", board({ jobTypes: ["art"] }), "art"],
    ["a feed without parser", feedBoard({ parser: undefined }), "parser"],
    ["a feed without endpoint", feedBoard({ endpoint: undefined }), "endpoint"],
    ["an unknown parser", feedBoard({ parser: "mystery" }), "mystery"],
    ["a placeholder without option", feedBoard({ endpoint: "https://x.com/{a}" }), "{a}"],
  ])("fails catalog-invalid for %s", async (_label, entry, needle) => {
    const result = await loadBundled([entry]);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("catalog-invalid");
    expect(result.error.message).toContain(needle);
  });

  test("fails on duplicate ids, naming the entry", async () => {
    const result = await loadBundled([board({}), board({})]);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.message).toContain('"demo"');
    expect(result.error.message).toContain("duplicate");
  });

  test("accepts a feed with options and a known parser", async () => {
    const entry = feedBoard({
      endpoint: "https://x.com/{category}.rss",
      options: { category: ["a"], default: ["a"] },
    });
    const result = await loadBundled([entry]);
    expect(result.ok).toBe(true);
  });
});

describe("loading order", () => {
  const remoteText = JSON.stringify([board({ id: "remote-board" })]);

  test("fetches, reports remote and writes the cache", async () => {
    const result = await loadCatalog({ env, fetchText: () => Promise.resolve(remoteText) });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.origin).toBe("remote");
    expect(result.value.boards[0]?.id).toBe("remote-board");
    expect(existsSync(path.join(cacheDir, "boards.json"))).toBe(true);
  });

  const SOURCE_URL = "https://example.com/a.json";

  function seedCache(): void {
    writeFileSync(path.join(cacheDir, "boards.json"), remoteText);
    writeFileSync(path.join(cacheDir, "boards.json.url"), SOURCE_URL);
  }

  test("uses a fresh cache from the same URL without fetching", async () => {
    seedCache();
    const result = await loadCatalog({
      env: { ...env, JOBSHIP_CATALOG_URL: SOURCE_URL },
      fetchText: neverFetch,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.origin).toBe("cache");
  });

  test("off uses the bundled copy even with a fresh cache", async () => {
    seedCache();
    const result = await loadCatalog({
      env: { ...env, JOBSHIP_CATALOG_URL: "off" },
      fetchText: neverFetch,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.origin).toBe("bundled");
  });

  test("a fresh cache from another URL is refetched", async () => {
    seedCache();
    const urls: string[] = [];
    const result = await loadCatalog({
      env: { ...env, JOBSHIP_CATALOG_URL: "https://example.com/b.json" },
      fetchText: (url) => {
        urls.push(url);
        return Promise.resolve(remoteText);
      },
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.origin).toBe("remote");
    expect(urls).toEqual(["https://example.com/b.json"]);
  });

  test("ignores a cache older than 24 hours", async () => {
    const file = path.join(cacheDir, "boards.json");
    writeFileSync(file, remoteText);
    const old = new Date(Date.now() - 25 * 3_600_000);
    utimesSync(file, old, old);
    const result = await loadCatalog({ env, fetchText: () => Promise.resolve(remoteText) });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.origin).toBe("remote");
  });

  test("falls back to bundled when the remote is invalid JSON", async () => {
    const result = await loadCatalog({ env, fetchText: () => Promise.resolve("{nope") });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.origin).toBe("bundled");
    expect(result.value.warnings.length).toBe(1);
    expect(existsSync(path.join(cacheDir, "boards.json"))).toBe(false);
  });

  test("falls back to bundled when the fetch throws", async () => {
    const result = await loadCatalog({ env, fetchText: neverFetch });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.origin).toBe("bundled");
  });

  test("skips a remote entry with an unknown parser and warns", async () => {
    const text = JSON.stringify([feedBoard({ id: "odd", parser: "mystery" }), board({ id: "ok" })]);
    const result = await loadCatalog({ env, fetchText: () => Promise.resolve(text) });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.boards.map((entry) => entry.id)).toEqual(["ok"]);
    expect(result.value.warnings[0]).toContain("odd");
  });

  test("JOBSHIP_CATALOG_URL selects the URL", async () => {
    const urls: string[] = [];
    await loadCatalog({
      env: { ...env, JOBSHIP_CATALOG_URL: "https://example.com/b.json" },
      fetchText: (url) => {
        urls.push(url);
        return Promise.resolve(remoteText);
      },
    });
    expect(urls).toEqual(["https://example.com/b.json"]);
  });
});

function make(regions: string[], workModes: Board["workModes"]): Board {
  return {
    id: "demo",
    name: "Demo",
    homepage: "https://example.com",
    access: "manual",
    regions,
    workModes,
    jobTypes: ["tech"],
  };
}

describe("matchesProfile", () => {
  test("global boards and empty profile regions match everything", () => {
    expect(matchesProfile(make(["global"], ["remote"]), { regions: ["JP"], remote: "any" })).toBe(
      true,
    );
    expect(matchesProfile(make(["DE"], ["onsite"]), { regions: [], remote: "any" })).toBe(true);
  });

  test("LATAM profile matches LATAM boards and not DE boards", () => {
    const profile = { regions: ["LATAM"], remote: "remote-only" } as const;
    expect(matchesProfile(make(["LATAM", "US"], ["remote", "hybrid"]), profile)).toBe(true);
    expect(matchesProfile(make(["DE"], ["remote"]), profile)).toBe(false);
  });

  test("EU contains member countries in both directions", () => {
    expect(matchesProfile(make(["EU"], ["remote"]), { regions: ["ES"], remote: "any" })).toBe(true);
    expect(matchesProfile(make(["DE"], ["remote"]), { regions: ["EU"], remote: "any" })).toBe(true);
    expect(matchesProfile(make(["UK"], ["remote"]), { regions: ["EU"], remote: "any" })).toBe(
      false,
    );
  });

  test("work mode rules", () => {
    const onsite = make(["global"], ["onsite"]);
    const hybrid = make(["global"], ["hybrid"]);
    expect(matchesProfile(onsite, { regions: [], remote: "remote-only" })).toBe(false);
    expect(matchesProfile(hybrid, { regions: [], remote: "remote-only" })).toBe(false);
    expect(matchesProfile(hybrid, { regions: [], remote: "hybrid" })).toBe(true);
    expect(matchesProfile(onsite, { regions: [], remote: "hybrid" })).toBe(false);
    expect(matchesProfile(onsite, { regions: [], remote: "any" })).toBe(true);
  });
});
