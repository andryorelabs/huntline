import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createNavAdapter } from "./nav.ts";
import { field, type FetchFunction } from "./http.ts";

const ENDPOINT = "https://pam-stilling-feed.nav.no/api/v1/feed";
const PAGE_ID = "0fd1a817-e705-483e-87e1-fab5a946d2c7";
const LAST_ID = "c105751f-2f23-4fa3-aa21-281351f390ea";
const ACTIVE_UUID = "f43a39cc-62a5-4e2d-9fd6-1fe8c62f92f1";

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dir, "fixtures", "api", name), "utf8");
}

function tokenBody(): string {
  const parsed: unknown = JSON.parse(fixture("nav-token.json"));
  const body = field(parsed, "text");
  if (typeof body !== "string") throw new Error("nav-token fixture needs a text field");
  return body;
}

type Call = { readonly url: string; readonly init: RequestInit | undefined };

type Route = (url: string) => Response | undefined;

function navFetch(route: Route, calls: Call[] = []): FetchFunction {
  return (input, init) => {
    calls.push({ url: input, init });
    if (input.endsWith("/api/publicToken")) return Promise.resolve(new Response(tokenBody()));
    return Promise.resolve(route(input) ?? new Response("missing", { status: 404 }));
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body));
}

function page(id: string, nextId: string | null, items: unknown[] = []): unknown {
  return { id, next_id: nextId, items };
}

function item(uuid: string, status: string): unknown {
  return {
    id: uuid,
    title: `Job ${uuid}`,
    date_modified: "2026-09-14T12:44:29.536+02:00",
    _feed_entry: {
      uuid,
      status,
      title: `Job ${uuid}`,
      businessName: "Example AS",
      municipal: "OSLO",
      sistEndret: "2026-09-14T12:44:29.536+02:00",
    },
  };
}

function standardRoute(url: string): Response | undefined {
  if (url.endsWith("/feed?last")) return new Response(fixture("nav-last.json"));
  if (url.endsWith(`/feed/${PAGE_ID}`)) return new Response(fixture("nav-page.json"));
  if (url.endsWith(`/feedentry/${ACTIVE_UUID}`)) return new Response(fixture("nav-entry.json"));
  return undefined;
}

const INACTIVE_DETAIL: Route = (url) =>
  url.endsWith(`/feedentry/${ACTIVE_UUID}`)
    ? json({ uuid: ACTIVE_UUID, status: "INACTIVE" })
    : standardRoute(url);

const STALE_CURSOR: Route = (url) =>
  url.endsWith("/feed/stale") ? new Response("gone", { status: 404 }) : standardRoute(url);

const ENDLESS_PAGES: Route = (url) => {
  const match = /\/feed\/p(\d+)$/.exec(url);
  if (match === null) return undefined;
  const index = Number(match[1]);
  return json(page(`p${index}`, `p${index + 1}`));
};

const FIRST_ENTRIES = Array.from({ length: 30 }, (_, index) => item(`a${index}`, "ACTIVE"));
const SECOND_ENTRIES = Array.from({ length: 30 }, (_, index) => item(`b${index}`, "ACTIVE"));

const BUSY_FEED: Route = (url) => {
  if (url.endsWith("/feed/p1")) return json(page("p1", "p2", FIRST_ENTRIES));
  if (url.endsWith("/feed/p2")) return json(page("p2", null, SECOND_ENTRIES));
  const detail = /\/feedentry\/(.+)$/.exec(url);
  return detail === null ? undefined : json({ uuid: detail[1], status: "ACTIVE" });
};

const LONG_PAGE_ENTRIES = Array.from({ length: 120 }, (_, index) => item(`c${index}`, "ACTIVE"));

const LONG_PAGE: Route = (url) => {
  if (url.endsWith("/feed/p1")) return json(page("p1", null, LONG_PAGE_ENTRIES));
  const detail = /\/feedentry\/(.+)$/.exec(url);
  return detail === null ? undefined : json({ uuid: detail[1], status: "ACTIVE" });
};

const REMOVED_ENTRY: Route = (url) =>
  url.endsWith(`/feedentry/${ACTIVE_UUID}`)
    ? new Response("gone", { status: 404 })
    : standardRoute(url);

const SERVER_ERROR: Route = () => new Response("boom", { status: 503 });
const ODD_SHAPE: Route = () => json({ unexpected: true });
const TOKEN_FAILURE: FetchFunction = () => Promise.resolve(new Response("nope", { status: 500 }));

describe("nav adapter", () => {
  test("initializes the cursor from the latest page when none is stored", async () => {
    const calls: Call[] = [];
    const result = await createNavAdapter(navFetch(standardRoute, calls), ENDPOINT).fetch({});
    expect(result.postings).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.nextCursor).toBe(LAST_ID);
    expect(result.warnings).toEqual(["nav: cursor initialized; Postings arrive on later sweeps"]);
    expect(calls.map((call) => call.url)).toEqual([
      "https://pam-stilling-feed.nav.no/api/publicToken",
      `${ENDPOINT}?last`,
    ]);
  });

  test("turns the ACTIVE entry of the cursor page into a Posting and keeps the cursor", async () => {
    const calls: Call[] = [];
    const result = await createNavAdapter(navFetch(standardRoute, calls), ENDPOINT).fetch({
      cursor: PAGE_ID,
    });
    expect(result.errors).toEqual([]);
    expect(result.nextCursor).toBe(`${PAGE_ID}:89da7f0d-f02b-4859-9f0d-87caf9a906c7`);
    expect(result.postings).toEqual([
      {
        id: `nav:${ACTIVE_UUID}`,
        source: "nav",
        url: `https://arbeidsplassen.nav.no/stillinger/stilling/${ACTIVE_UUID}`,
        company: "Example Tech AS",
        title: "Backend developer",
        location: "OSLO",
        postedAt: "2026-09-14T10:44:29.536Z",
      },
    ]);
    const feedCalls = calls.filter((call) => !call.url.endsWith("/api/publicToken"));
    expect(feedCalls).toHaveLength(2);
    for (const call of feedCalls) {
      expect(new Headers(call.init?.headers).get("authorization")).toStartWith("Bearer eyJ");
      expect(call.init?.method ?? "GET").toBe("GET");
    }
  });

  test("skips an entry whose detail is no longer ACTIVE", async () => {
    const result = await createNavAdapter(navFetch(INACTIVE_DETAIL), ENDPOINT).fetch({
      cursor: PAGE_ID,
    });
    expect(result.postings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  test("restarts from the latest page when the stored cursor is gone", async () => {
    const calls: Call[] = [];
    const result = await createNavAdapter(navFetch(STALE_CURSOR, calls), ENDPOINT).fetch({
      cursor: "stale",
    });
    expect(result.errors).toEqual([]);
    expect(result.postings).toEqual([]);
    expect(result.nextCursor).toBe(LAST_ID);
    expect(result.warnings[0]).toContain("no longer served");
    expect(calls.filter((call) => call.url.includes("/feed/stale"))).toHaveLength(1);
  });

  test("stops after 10 pages and resumes from the last processed page", async () => {
    const result = await createNavAdapter(navFetch(ENDLESS_PAGES), ENDPOINT).fetch({
      cursor: "p1",
    });
    expect(result.errors).toEqual([]);
    expect(result.nextCursor).toBe("p10");
    expect(result.warnings).toEqual(["nav: stopped after 10 pages; resuming next sweep"]);
  });

  test("stops after 50 entries without skipping the unfinished page", async () => {
    const result = await createNavAdapter(navFetch(BUSY_FEED), ENDPOINT).fetch({ cursor: "p1" });
    expect(result.postings).toHaveLength(50);
    expect(result.nextCursor).toBe("p2:b19");
    expect(result.warnings).toEqual(["nav: stopped after 50 entries; resuming next sweep"]);
  });

  test("a second sweep resumes mid-page and reaches the later entries", async () => {
    const adapter = createNavAdapter(navFetch(BUSY_FEED), ENDPOINT);
    const first = await adapter.fetch({ cursor: "p1" });
    const second = await adapter.fetch({ cursor: first.nextCursor ?? "" });
    expect(second.errors).toEqual([]);
    expect(second.warnings).toEqual([]);
    expect(second.postings.map((posting) => posting.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `nav:b${20 + index}`),
    );
    expect(second.nextCursor).toBe("p2:b29");
  });

  test("three sweeps over a page of more than 50 entries yield each entry once", async () => {
    const adapter = createNavAdapter(navFetch(LONG_PAGE), ENDPOINT);
    const first = await adapter.fetch({ cursor: "p1" });
    const second = await adapter.fetch({ cursor: first.nextCursor ?? "" });
    const third = await adapter.fetch({ cursor: second.nextCursor ?? "" });
    const fourth = await adapter.fetch({ cursor: third.nextCursor ?? "" });
    expect([first, second, third, fourth].map((result) => result.postings.length)).toEqual([
      50, 50, 20, 0,
    ]);
    const seen = [first, second, third].flatMap((result) =>
      result.postings.map((posting) => posting.id),
    );
    const cursor = fourth.nextCursor;
    expect(seen).toEqual(LONG_PAGE_ENTRIES.map((_, index) => `nav:c${index}`));
    expect(cursor).toBe("p1:c119");
  });

  test("reads a page from its start when the stored entry is gone", async () => {
    const result = await createNavAdapter(navFetch(standardRoute), ENDPOINT).fetch({
      cursor: `${PAGE_ID}:missing`,
    });
    expect(result.postings).toHaveLength(1);
    expect(result.warnings[0]).toContain("not found on page");
  });

  test("a removed entry is skipped and the cursor still advances", async () => {
    const result = await createNavAdapter(navFetch(REMOVED_ENTRY), ENDPOINT).fetch({
      cursor: PAGE_ID,
    });
    expect(result.errors).toEqual([]);
    expect(result.postings).toEqual([]);
    expect(result.nextCursor).toBe(`${PAGE_ID}:89da7f0d-f02b-4859-9f0d-87caf9a906c7`);
  });

  test("fails only nav on a token failure", async () => {
    const result = await createNavAdapter(TOKEN_FAILURE, ENDPOINT).fetch({});
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toStartWith("nav:");
    expect(result.nextCursor).toBeUndefined();
  });

  test("fails on a non-2xx feed response and an unexpected shape", async () => {
    const unavailable = await createNavAdapter(navFetch(SERVER_ERROR), ENDPOINT).fetch({
      cursor: "x",
    });
    expect(unavailable.errors[0]).toContain("HTTP 503");
    const shape = await createNavAdapter(navFetch(ODD_SHAPE), ENDPOINT).fetch({});
    expect(shape.errors[0]).toContain("unexpected response shape");
    expect(shape.nextCursor).toBeUndefined();
  });
});
