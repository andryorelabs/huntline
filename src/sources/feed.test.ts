import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { FetchFunction } from "./http.ts";
import { createFeedAdapter, createJobFeedXmlAdapter, createNhsXmlAdapter } from "./feed.ts";

function bytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(import.meta.dir, "fixtures", "feed", name)));
}

function serving(name: string, requested?: string[]): FetchFunction {
  return (input) => {
    requested?.push(input);
    return Promise.resolve(new Response(bytes(name)));
  };
}

const RSS = { id: "wwr", endpoint: "https://jobs.example.test/feed.xml" };

describe("createFeedAdapter", () => {
  test("maps RSS items with CDATA, entities, relative links and missing dates", async () => {
    const requested: string[] = [];
    const result = await createFeedAdapter(serving("rss.xml", requested), RSS).fetch({});
    expect(requested).toEqual([RSS.endpoint]);
    expect(result.errors).toEqual([]);
    expect(result.postings).toHaveLength(2);
    const [first, second] = result.postings;
    expect(first).toMatchObject({
      id: "wwr:acme-senior-backend",
      source: "wwr",
      url: "https://jobs.example.test/listings/acme-senior-backend",
      company: "Acme Corp",
      title: "Senior Backend Engineer",
      postedAt: "2026-11-10T09:00:00.000Z",
    });
    expect(first?.description).toContain("Build APIs & services.");
    expect(first?.description).not.toContain("<");
    expect(second).toMatchObject({
      url: "https://jobs.example.test/listings/globex-platform",
      company: "Globex & Sons",
      title: "Platform Engineer",
    });
    expect(second?.postedAt).toBeUndefined();
    expect(second?.description).toBe("Run the platform & tooling");
    expect(result.warnings).toHaveLength(1);
  });

  test("accepts any media type as a fallback for boards that reject XML-only requests", async () => {
    const accepted: string[] = [];
    const fetchFunction: FetchFunction = (_input, init) => {
      accepted.push(new Headers(init?.headers).get("accept") ?? "");
      return Promise.resolve(new Response(bytes("rss.xml")));
    };
    await createFeedAdapter(fetchFunction, RSS).fetch({});
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toContain("application/rss+xml");
    expect(accepted[0]).toContain("*/*;q=0.1");
  });

  test("maps Atom entries preferring the alternate link", async () => {
    const result = await createFeedAdapter(serving("atom.xml"), {
      id: "tokyodev",
      endpoint: "https://atom.example.test/jobs/atom.xml",
    }).fetch({});
    expect(result.postings).toHaveLength(1);
    expect(result.postings[0]).toMatchObject({
      id: "tokyodev:tag:atom.example.test,2026:job-1",
      url: "https://atom.example.test/jobs/frontend-engineer",
      company: "Initech",
      title: "Frontend Engineer",
      postedAt: "2026-11-09T08:30:00.000Z",
      description: "Work on the web app.",
    });
  });

  test("decodes ISO-8859-1 with the encoding option", async () => {
    const result = await createFeedAdapter(serving("latin1.xml"), {
      id: "net-empregos",
      endpoint: "https://latin.example.test/rss.asp",
      encoding: "iso-8859-1",
    }).fetch({});
    expect(result.postings[0]?.title).toBe("Engenheiro de Software em Setúbal");
    expect(result.postings[0]?.description).toBe("Experiência com informática e gestão.");
  });

  test("honours the XML declaration encoding when no option is given", async () => {
    const result = await createFeedAdapter(serving("latin1.xml"), {
      id: "net-empregos",
      endpoint: "https://latin.example.test/rss.asp",
    }).fetch({});
    expect(result.postings[0]?.title).toBe("Engenheiro de Software em Setúbal");
  });

  test("reads items under a non-standard root", async () => {
    const result = await createFeedAdapter(serving("myjobmag.xml"), {
      id: "myjobmag",
      endpoint: "https://myjobmag.example.test/jobsxml.xml",
    }).fetch({});
    expect(result.postings).toHaveLength(1);
    expect(result.postings[0]?.description).toContain("Prepare ledgers");
    expect(result.postings[0]?.description).toContain("and reports.");
  });

  test("filters by keywords client-side", async () => {
    const result = await createFeedAdapter(serving("rss.xml"), RSS).fetch({
      keywords: ["platform"],
    });
    expect(result.postings.map((posting) => posting.title)).toEqual(["Platform Engineer"]);
  });

  test("fails this board only on malformed XML, HTML and HTTP errors", async () => {
    const malformed = await createFeedAdapter(serving("malformed.xml"), RSS).fetch({});
    expect(malformed.postings).toEqual([]);
    expect(malformed.errors[0]).toContain("wwr");
    const html = await createFeedAdapter(serving("not-a-feed.html"), RSS).fetch({});
    expect(html.errors[0]).toContain("not an RSS or Atom feed");
    const status = await createFeedAdapter(
      () => Promise.resolve(new Response("nope", { status: 503 })),
      RSS,
    ).fetch({});
    expect(status.errors[0]).toContain("HTTP 503");
    const network = await createFeedAdapter(() => Promise.reject(new Error("refused")), RSS).fetch(
      {},
    );
    expect(network.errors[0]).toContain("refused");
  });

  test("rejects an oversized response", async () => {
    const huge = new Uint8Array(6 * 1024 * 1024).fill(32);
    const declared = await createFeedAdapter(
      () =>
        Promise.resolve(new Response(huge, { headers: { "content-length": String(huge.length) } })),
      RSS,
    ).fetch({});
    expect(declared.errors[0]).toContain("too large");
    const streamed = await createFeedAdapter(
      () => Promise.resolve(new Response(new Blob([huge]).stream())),
      RSS,
    ).fetch({});
    expect(streamed.errors[0]).toContain("too large");
  });

  test("stops consuming a streamed body once it passes the cap", async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024 * 1024).fill(32));
      },
    });
    const result = await createFeedAdapter(() => Promise.resolve(new Response(endless)), RSS).fetch(
      {},
    );
    expect(result.errors[0]).toContain("too large");
    expect(pulled).toBeLessThan(20);
  });
});

describe("entity expansion", () => {
  test("a feed expanding one internal entity many times fails that board only", async () => {
    const entity = "x".repeat(9_000);
    const references = "&big;".repeat(200_000);
    const xml = `<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY big "${entity}">]><rss><channel><item><title>${references}</title><link>https://jobs.example.test/1</link></item></channel></rss>`;
    const result = await createFeedAdapter(() => Promise.resolve(new Response(xml)), RSS).fetch({});
    expect(result.postings).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});

describe("createJobFeedXmlAdapter", () => {
  test("maps job elements and detects full remote", async () => {
    const result = await createJobFeedXmlAdapter(serving("job-feed.xml"), {
      id: "devitjobs",
      endpoint: "https://devitjobs.example.test/job_feed.xml",
    }).fetch({});
    expect(result.errors).toEqual([]);
    expect(result.postings).toHaveLength(2);
    expect(result.postings[0]).toMatchObject({
      id: "devitjobs:9001",
      source: "devitjobs",
      company: "Hooli",
      title: "Senior Java Developer",
      url: "https://devitjobs.example.test/jobs/hooli-senior-java",
      contract: "Full-time",
      remote: true,
      workMode: "remote",
      description: "Java & Spring.",
    });
    expect(result.postings[0]?.location).toContain("Berlin");
    expect(result.postings[1]).toMatchObject({
      url: "https://devitjobs.example.test/jobs/pied-piper-qa",
      location: "Zurich, Switzerland",
    });
    expect(result.postings[1]?.remote).toBeUndefined();
    expect(result.postings[0]?.postedAt).toBe("2026-11-08T00:00:00.000Z");
    expect(result.postings[1]?.postedAt).toBe("2020-12-01T00:00:00.000Z");
    expect(result.warnings).toHaveLength(1);
  });

  test("fails on a non job feed", async () => {
    const result = await createJobFeedXmlAdapter(serving("rss.xml"), {
      id: "devitjobs",
      endpoint: "https://devitjobs.example.test/job_feed.xml",
    }).fetch({});
    expect(result.errors[0]).toContain("job_feed");
  });
});

describe("createNhsXmlAdapter", () => {
  test("maps live-shaped vacancies with several locations and a post date", async () => {
    const result = await createNhsXmlAdapter(serving("nhs.xml"), {
      id: "nhs",
      endpoint: "https://www.jobs.nhs.example.test/api/v1/search_xml",
    }).fetch({});
    expect(result.errors).toEqual([]);
    expect(result.postings).toHaveLength(3);
    expect(result.postings[0]).toMatchObject({
      id: "nhs:85273",
      source: "nhs",
      company: "Honeypot Medical Centre",
      title: "Salaried GP",
      url: "https://beta.jobs.nhs.uk/candidate/jobadvert/A1952-21-0091",
      location: "Stanmore, HA7 1JP; HARROW, HA3 9HT",
      contract: "Permanent",
      postedAt: "2026-11-13T00:33:34.257Z",
    });
    expect(result.postings[1]?.location).toBe("Rochdale, OL12 9DW");
  });
});
