import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "./command.ts";
import { detectAts } from "./detect.ts";
import type { FetchFunction } from "./http.ts";
import { createSources } from "./index.ts";

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dir, "fixtures", `${name}.json`), "utf8");
}

function routedFetch(routes: Record<string, string>): FetchFunction {
  return (input) => {
    const match = Object.entries(routes).find(([fragment]) => input.includes(fragment));
    if (match === undefined) return Promise.resolve(new Response("not found", { status: 404 }));
    return Promise.resolve(new Response(match[1], { headers: { "content-type": "application/json" } }));
  };
}

function statusFetch(status: number): FetchFunction {
  return () => Promise.resolve(new Response("nope", { status }));
}

const throwingFetch: FetchFunction = () => Promise.reject(new Error("connection refused"));

const ATS_CASES = [
  ["greenhouse", "boards-api.greenhouse.io", "greenhouse:acme:101"],
  ["lever", "api.lever.co", "lever:acme:abc-1"],
  ["ashby", "api.ashbyhq.com", "ashby:acme:7f1"],
  ["workable", "apply.workable.com/api", "workable:acme:AB12CD"],
  ["smartrecruiters", "api.smartrecruiters.com", "smartrecruiters:acme:743999"],
] as const;

describe("company adapters", () => {
  for (const [name, fragment, expectedId] of ATS_CASES) {
    test(`${name} normalizes the recorded fixture`, async () => {
      const sources = createSources(routedFetch({ [fragment]: fixture(name) }));
      const result = await sources[name]?.fetch({ slug: "acme" });
      expect(result?.errors).toEqual([]);
      expect(result?.postings).toHaveLength(1);
      const [posting] = result?.postings ?? [];
      expect(posting?.id).toBe(expectedId);
      expect(posting?.source).toBe(name);
      expect(posting?.url.startsWith("https://")).toBe(true);
      expect(posting?.title).not.toBe("");
    });

    test(`${name} reports HTTP 429 as an error, not an empty success`, async () => {
      const result = await createSources(statusFetch(429))[name]?.fetch({ slug: "acme" });
      expect(result?.postings).toEqual([]);
      expect(result?.errors[0]).toContain("429");
    });

    test(`${name} reports a network error`, async () => {
      const result = await createSources(throwingFetch)[name]?.fetch({ slug: "acme" });
      expect(result?.errors[0]).toContain("connection refused");
    });

    test(`${name} requires a slug`, async () => {
      const result = await createSources(throwingFetch)[name]?.fetch({});
      expect(result?.errors).toHaveLength(1);
    });
  }

  test("greenhouse keeps warnings apart and strips HTML", async () => {
    const sources = createSources(routedFetch({ "boards-api.greenhouse.io": fixture("greenhouse") }));
    const result = await sources["greenhouse"]?.fetch({ slug: "acme" });
    expect(result?.warnings).toHaveLength(1);
    expect(result?.postings[0]).toMatchObject({
      company: "Acme Corp",
      remote: true,
      description: "Build APIs",
      postedAt: "2026-10-01T12:00:00.000Z",
    });
  });

  test("an empty board is an empty success with no errors", async () => {
    const sources = createSources(routedFetch({ "api.ashbyhq.com": '{"jobs":[]}' }));
    const result = await sources["ashby"]?.fetch({ slug: "acme" });
    expect(result).toEqual({ postings: [], errors: [], warnings: [] });
  });

  test("an unexpected response shape is an error", async () => {
    const sources = createSources(routedFetch({ "api.ashbyhq.com": '{"unexpected":true}' }));
    const result = await sources["ashby"]?.fetch({ slug: "acme" });
    expect(result?.errors).toHaveLength(1);
  });

  test("invalid JSON is an error", async () => {
    const sources = createSources(routedFetch({ "api.ashbyhq.com": "<html>" }));
    const result = await sources["ashby"]?.fetch({ slug: "acme" });
    expect(result?.errors[0]).toContain("invalid JSON");
  });
});

describe("board adapters", () => {
  test("getonboard normalizes the fixture", async () => {
    const sources = createSources(routedFetch({ "getonbrd.com": fixture("getonboard") }));
    const result = await sources["getonboard"]?.fetch({ keywords: ["developer"] });
    expect(result?.errors).toEqual([]);
    expect(result?.postings[0]).toMatchObject({
      id: "getonboard:fullstack-dev-acme",
      company: "Acme",
      location: "Chile, Peru",
      remote: true,
      salary: { min: 3000, max: 5000, currency: "USD" },
    });
  });

  test("second-precision timestamps become real dates", async () => {
    const sources = createSources(routedFetch({ "getonbrd.com": fixture("getonboard") }));
    const result = await sources["getonboard"]?.fetch({ keywords: ["developer"] });
    expect(result?.postings[0]?.postedAt?.startsWith("20")).toBe(true);
  });

  test("himalayas normalizes and filters by keyword", async () => {
    const sources = createSources(routedFetch({ "himalayas.app": fixture("himalayas") }));
    const result = await sources["himalayas"]?.fetch({ keywords: ["rust"] });
    expect(result?.postings).toHaveLength(1);
    expect(result?.postings[0]).toMatchObject({
      company: "Acme",
      salary: { min: 90000, max: 120000, currency: "USD" },
      location: "Brazil, Chile",
    });
  });

  test("remoteok skips the legal header and maps tags to stack", async () => {
    const sources = createSources(routedFetch({ "remoteok.com": fixture("remoteok") }));
    const result = await sources["remoteok"]?.fetch({});
    expect(result?.warnings).toEqual([]);
    expect(result?.postings).toHaveLength(1);
    expect(result?.postings[0]).toMatchObject({ id: "remoteok:555", stack: ["typescript", "node"] });
  });

  test("hn finds the hiring thread then parses job comments", async () => {
    const sources = createSources(
      routedFetch({ "search_by_date": fixture("hn-stories"), "story_900001": fixture("hn-comments") }),
    );
    const result = await sources["hn"]?.fetch({});
    expect(result?.errors).toEqual([]);
    expect(result?.postings).toHaveLength(1);
    expect(result?.postings[0]).toMatchObject({
      id: "hn:900101",
      company: "Acme",
      title: "Senior Engineer",
      remote: true,
      url: "https://news.ycombinator.com/item?id=900101",
    });
    expect(result?.warnings).toHaveLength(1);
  });

  test("hn errors when no hiring thread exists", async () => {
    const sources = createSources(routedFetch({ "search_by_date": '{"hits":[]}' }));
    const result = await sources["hn"]?.fetch({});
    expect(result?.errors).toHaveLength(1);
  });

  for (const name of ["getonboard", "himalayas", "remoteok", "hn"]) {
    test(`${name} reports HTTP 429 as an error`, async () => {
      const result = await createSources(statusFetch(429))[name]?.fetch({});
      expect(result?.postings).toEqual([]);
      expect(result?.errors[0]).toContain("429");
    });

    test(`${name} reports a network error`, async () => {
      const result = await createSources(throwingFetch)[name]?.fetch({});
      expect(result?.errors).toHaveLength(1);
    });
  }

  test("registers all nine adapters", () => {
    expect(Object.keys(createSources(throwingFetch)).toSorted()).toEqual([
      "ashby",
      "getonboard",
      "greenhouse",
      "himalayas",
      "hn",
      "lever",
      "remoteok",
      "smartrecruiters",
      "workable",
    ]);
  });
});

describe("detectAts", () => {
  test.each([
    ["https://jobs.ashbyhq.com/acme", { ats: "ashby", slug: "acme" }],
    ["https://boards.greenhouse.io/acme/jobs/101", { ats: "greenhouse", slug: "acme" }],
    ["https://job-boards.greenhouse.io/acme", { ats: "greenhouse", slug: "acme" }],
    ["https://boards.greenhouse.io/embed/job_board?for=acme", { ats: "greenhouse", slug: "acme" }],
    ["https://jobs.lever.co/acme/abc", { ats: "lever", slug: "acme" }],
    ["https://apply.workable.com/acme/", { ats: "workable", slug: "acme" }],
    ["https://jobs.smartrecruiters.com/AcmeGroup", { ats: "smartrecruiters", slug: "AcmeGroup" }],
  ])("%s", (url, expected) => {
    expect(detectAts(url)).toEqual(expected);
  });

  test("returns null for unknown hosts", () => {
    expect(detectAts("https://acme.example/careers")).toBeNull();
    expect(detectAts("not a url")).toBeNull();
    expect(detectAts("https://jobs.ashbyhq.com/%2E%2E%2F%3Fx")).toBeNull();
    expect(detectAts("https://jobs.ashbyhq.com/%zz")).toBeNull();
  });
});

describe("company command", () => {
  let dataDir = "";
  const cliPath = path.join(import.meta.dir, "../cli.ts");

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), "huntline-sources-"));
    writeFileSync(path.join(dataDir, "huntline.json"), '{"version":1}\n');
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  function spawn(args: string[]): { code: number; envelope: Record<string, unknown> } {
    const result = Bun.spawnSync([process.execPath, cliPath, ...args, "--data", dataDir], {
      env: { PATH: process.env["PATH"] ?? "", HOME: dataDir },
    });
    const parsed: unknown = JSON.parse(result.stdout.toString().trim());
    return { code: result.exitCode, envelope: { ...(parsed as Record<string, unknown>) } };
  }

  test("company add stores ats and slug, list returns them, repeat is idempotent", () => {
    const first = spawn(["company", "add", "https://jobs.ashbyhq.com/acme"]);
    expect(first.code).toBe(0);
    expect(first.envelope["data"]).toEqual({ added: true, company: { ats: "ashby", slug: "acme" } });
    expect(JSON.parse(readFileSync(path.join(dataDir, "companies.json"), "utf8"))).toEqual({
      companies: [{ ats: "ashby", slug: "acme" }],
    });
    const again = spawn(["company", "add", "https://jobs.ashbyhq.com/acme"]);
    expect((again.envelope["data"] as { added: boolean }).added).toBe(false);
    const listed = spawn(["company", "list"]);
    expect(listed.envelope["data"]).toEqual({ companies: [{ ats: "ashby", slug: "acme" }] });
  });

  test("an unsupported url exits 1 with an error envelope", () => {
    const result = spawn(["company", "add", "https://acme.example/careers"]);
    expect(result.code).toBe(1);
    expect((result.envelope["error"] as { code: string }).code).toBe("unsupported-careers-url");
  });

  test("missing arguments are a usage error", () => {
    expect(spawn(["company", "add"]).code).toBe(2);
    expect(spawn(["company"]).code).toBe(2);
  });

  test("a malformed companies file is reported, not overwritten", async () => {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "companies.json"), "{oops");
    const envelope = await run(["list"], { dataDir: { path: dataDir }, env: {}, cwd: dataDir });
    expect(envelope.ok).toBe(false);
    expect(readFileSync(path.join(dataDir, "companies.json"), "utf8")).toBe("{oops");
  });
});
