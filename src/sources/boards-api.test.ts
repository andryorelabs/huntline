import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SourceAdapter } from "../core/types.ts";
import { createApiBoardAdapters, type ApiBoardName } from "./boards-api.ts";
import type { FetchFunction } from "./http.ts";

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dir, "fixtures", "api", name), "utf8");
}

type Call = { readonly url: string; readonly init: RequestInit | undefined };

function recordingFetch(routes: Record<string, string>, calls: Call[] = []): FetchFunction {
  return (input, init) => {
    calls.push({ url: input, init });
    const match = Object.entries(routes).find(([fragment]) => input.includes(fragment));
    if (match === undefined) return Promise.resolve(new Response("not found", { status: 404 }));
    return Promise.resolve(new Response(match[1]));
  };
}

function bodyText(call: Call | undefined): string {
  const body = call?.init?.body;
  if (typeof body !== "string") throw new Error("expected a string body");
  return body;
}

function adapterFor(name: ApiBoardName, fetchFunction: FetchFunction, endpoint?: string) {
  const adapters = createApiBoardAdapters(
    fetchFunction,
    endpoint === undefined ? {} : { [name]: endpoint },
  );
  const found = adapters.find((adapter) => adapter.name === name);
  if (found === undefined) throw new Error(`missing adapter ${name}`);
  return found satisfies SourceAdapter;
}

const SIMPLE_CASES = [
  ["remotive", "remotive.com", "remotive.json", 2],
  ["jobicy", "jobicy.com", "jobicy.json", 1],
  ["arbeitnow", "arbeitnow.com", "arbeitnow.json", 2],
  ["workingnomads", "workingnomads.com", "workingnomads.json", 2],
  ["jobtech", "jobtechdev.se", "jobtech.json", 2],
  ["mycareersfuture", "mycareersfuture.gov.sg", "mycareersfuture.json", 2],
  ["bundesagentur", "arbeitsagentur.de", "bundesagentur.json", 3],
] as const;

describe("api board adapters", () => {
  test("exposes the ten catalog parser names", () => {
    const names = createApiBoardAdapters(recordingFetch({})).map((adapter) => adapter.name);
    expect(names).toEqual([
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
    ]);
  });

  for (const [name, host, file, count] of SIMPLE_CASES) {
    test(`${name} maps fixture rows to postings`, async () => {
      const result = await adapterFor(name, recordingFetch({ [host]: fixture(file) })).fetch({});
      expect(result.errors).toEqual([]);
      expect(result.postings).toHaveLength(count);
      for (const posting of result.postings) {
        expect(posting.source).toBe(name);
        expect(posting.title).not.toBe("");
        expect(posting.url.startsWith("https://")).toBe(true);
        expect(posting.id.startsWith(`${name}:`)).toBe(true);
      }
    });

    test(`${name} fails alone on a malformed response`, async () => {
      const result = await adapterFor(name, recordingFetch({ [host]: "<html>" })).fetch({});
      expect(result.postings).toEqual([]);
      expect(result.errors[0]).toStartWith(`${name}:`);
    });
  }

  test("remotive filters category client-side from the endpoint override", async () => {
    const adapter = adapterFor(
      "remotive",
      recordingFetch({ remotive: fixture("remotive.json") }),
      "https://remotive.com/api/remote-jobs?category=software-dev",
    );
    const none = await adapter.fetch({});
    expect(none.postings.map((posting) => posting.title)).toEqual([]);
    const matching = adapterFor(
      "remotive",
      recordingFetch({ remotive: fixture("remotive.json") }),
      "https://remotive.com/api/remote-jobs?category=Marketing",
    );
    expect((await matching.fetch({})).postings.map((posting) => posting.title)).toEqual([
      "Growth Lead",
    ]);
  });

  test("arbeitnow derives workMode from the remote boolean", async () => {
    const result = await adapterFor(
      "arbeitnow",
      recordingFetch({ arbeitnow: fixture("arbeitnow.json") }),
    ).fetch({});
    expect(result.postings.map((posting) => posting.workMode)).toEqual(["remote", "onsite"]);
  });

  test("bundesagentur sends the public client id and maps the live v6 shape", async () => {
    const calls: Call[] = [];
    const result = await adapterFor(
      "bundesagentur",
      recordingFetch({ arbeitsagentur: fixture("bundesagentur.json") }, calls),
    ).fetch({});
    expect(new Headers(calls[0]?.init?.headers).get("x-api-key")).toBe("jobboerse-jobsuche");
    expect(result.postings.map((posting) => posting.workMode)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(result.postings[0]).toMatchObject({
      id: "bundesagentur:10001-1004008481-S",
      url: "https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1004008481-S",
      company: "Beispiel Jugendhilfe GbR",
      location: "Beedenbostel, NIEDERSACHSEN",
      postedAt: "2026-11-13T00:00:00.000Z",
    });
    expect(result.postings[2]?.title).toBe("Buchhalter/in");
  });

  test("keywords filter client-side", async () => {
    const result = await adapterFor(
      "jobtech",
      recordingFetch({ jobtechdev: fixture("jobtech.json") }),
    ).fetch({ keywords: ["kock"] });
    expect(result.postings.map((posting) => posting.title)).toEqual(["Kock"]);
  });

  test("hnjobs fetches capped items and skips unusable ones", async () => {
    const calls: Call[] = [];
    const result = await adapterFor(
      "hnjobs",
      recordingFetch(
        {
          "jobstories.json": fixture("hn-jobstories.json"),
          "item/4001.json": fixture("hn-item-4001.json"),
          "item/4002.json": fixture("hn-item-4002.json"),
        },
        calls,
      ),
    ).fetch({});
    expect(result.errors).toEqual([]);
    expect(result.postings.map((posting) => posting.company)).toEqual([
      "Stripe Press",
      "Widgets Inc",
    ]);
    expect(result.postings[1]?.url).toBe("https://news.ycombinator.com/item?id=4002");
    expect(result.postings[1]?.description).toBe("Join us & design things.");
    expect(result.warnings).toEqual(["skipped item 4003"]);
    expect(calls).toHaveLength(4);
  });

  test("eures posts only the search body and attributes the ELA", async () => {
    const calls: Call[] = [];
    const result = await adapterFor(
      "eures",
      recordingFetch({ "jv-search/search": fixture("eures.json") }, calls),
    ).fetch({ keywords: ["developer"] });
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(bodyText(calls[0]))).toEqual({
      keywords: [{ keyword: "developer", specificSearchCode: "EVERYWHERE" }],
      sortSearch: "MOST_RECENT",
      resultsPerPage: 50,
      page: 1,
      publicationPeriod: "LAST_WEEK",
    });
    expect(result.postings.map((posting) => posting.title)).toEqual(["Software Developer"]);
    expect(result.warnings[0]).toContain("European Labour Authority");
  });

  test("cbop posts an empty body", async () => {
    const calls: Call[] = [];
    const result = await adapterFor(
      "cbop",
      recordingFetch({ "portal-api": fixture("cbop.json") }, calls),
    ).fetch({});
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe("{}");
    expect(result.postings).toHaveLength(2);
    expect(result.postings[0]).toMatchObject({
      postedAt: "2026-11-13T00:00:00.000Z",
      contract: "Umowa o prace na czas okreslony",
      location: "Ojrzen, mazowieckie",
    });
    expect(JSON.stringify(result.postings)).not.toMatch(/osobaDoKontaktu|telefon|email/);
  });

  test("an oversized response fails that adapter only", async () => {
    const huge = `{"jobs":[],"pad":"${"x".repeat(8_100_000)}"}`;
    const result = await adapterFor("jobicy", recordingFetch({ jobicy: huge })).fetch({});
    expect(result.errors[0]).toContain("too large");
  });
});
