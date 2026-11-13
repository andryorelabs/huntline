import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Profile } from "../core/types.ts";
import type { Board } from "./catalog.ts";
import { readCustomBoards, writeCustomBoards } from "./custom-boards.ts";
import { resolveBoards } from "./resolve.ts";

const OFF = { JOBSHIP_CATALOG_URL: "off" };

let root = "";

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jobship-resolve-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function profileWith(overrides: Partial<Profile>): Profile {
  return {
    regions: ["LATAM"],
    contractTypes: ["full-time"],
    remote: "remote-only",
    stack: { include: [], exclude: [] },
    salaryFloor: null,
    excludedCompanies: [],
    outreachDailyCap: 5,
    sources: [],
    tracker: { kind: "local" },
    ...overrides,
  };
}

const CUSTOM: Board = {
  id: "my-feed",
  name: "My feed",
  homepage: "https://feed.example.test",
  access: "feed",
  regions: ["global"],
  workModes: ["remote"],
  jobTypes: ["general"],
  parser: "rss",
  endpoint: "https://feed.example.test/rss.xml",
};

async function resolveIds(overrides: Partial<Profile>): Promise<string[]> {
  const resolved = await resolveBoards(profileWith(overrides), { path: root }, { env: OFF });
  if (!resolved.ok) throw new Error(resolved.error.message);
  return resolved.value.map((entry) => entry.id);
}

describe("resolveBoards", () => {
  test("empty sources select feed boards matching the Profile regions and remote", async () => {
    const ids = await resolveIds({});
    expect(ids).toContain("getonboard");
    expect(ids).toContain("weworkremotely");
    expect(ids).not.toContain("berlinstartupjobs");
    expect(ids).not.toContain("wellfound");
  });

  test("remote any widens the set to on-site boards of the region", async () => {
    const remoteOnly = await resolveIds({ regions: ["DE"], remote: "remote-only" });
    const any = await resolveIds({ regions: ["DE"], remote: "any" });
    expect(remoteOnly).not.toContain("bundesagentur");
    expect(any).toContain("bundesagentur");
  });

  test("an explicit list is used as given and every entry has an adapter", async () => {
    const resolved = await resolveBoards(
      profileWith({ sources: ["remoteok", "greenhouse", "weworkremotely"] }),
      { path: root },
      { env: OFF },
    );
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.value.map((entry) => entry.id)).toEqual([
      "remoteok",
      "greenhouse",
      "weworkremotely",
    ]);
    expect(resolved.value.every((entry) => entry.adapter !== undefined)).toBe(true);
  });

  test("id:option resolves the option endpoint and rejects unknown options", async () => {
    const requested: string[] = [];
    const resolved = await resolveBoards(
      profileWith({
        sources: [
          "weworkremotely:remote-devops-sysadmin-jobs",
          "weworkremotely:nope",
          "remoteok:x",
          "ghost",
        ],
      }),
      { path: root },
      {
        env: OFF,
        fetch: (input) => {
          requested.push(input);
          return Promise.resolve(new Response("", { status: 404 }));
        },
      },
    );
    if (!resolved.ok) throw new Error(resolved.error.message);
    const [option, badOption, unsupported, unknown] = resolved.value;
    await option?.adapter?.fetch({});
    expect(requested).toEqual([
      "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    ]);
    expect(badOption?.problem).toContain("not an option");
    expect(unsupported?.problem).toContain("does not support options");
    expect(unknown?.problem).toBe("ghost: unknown source");
  });

  test("an option on an API board overrides its endpoint", async () => {
    const requested: string[] = [];
    const resolved = await resolveBoards(
      profileWith({ sources: ["jobicy:latam"] }),
      { path: root },
      {
        env: OFF,
        fetch: (input) => {
          requested.push(input);
          return Promise.resolve(new Response("{}"));
        },
      },
    );
    if (!resolved.ok) throw new Error(resolved.error.message);
    await resolved.value[0]?.adapter?.fetch({});
    expect(requested[0]).toContain("geo=latam");
    expect(resolved.value[0]?.minIntervalMinutes).toBe(60);
  });

  test("an option on getonboard fetches its category endpoint", async () => {
    const requested: string[] = [];
    const resolved = await resolveBoards(
      profileWith({ sources: ["getonboard:sysadmin-devops-qa"] }),
      { path: root },
      {
        env: OFF,
        fetch: (input) => {
          requested.push(input);
          return Promise.resolve(new Response('{"data":[]}'));
        },
      },
    );
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.value[0]?.problem).toBeUndefined();
    await resolved.value[0]?.adapter?.fetch({});
    expect(requested[0]).toContain("/categories/sysadmin-devops-qa/jobs");
  });

  test("browser boards in an explicit list resolve without an adapter or problem", async () => {
    const resolved = await resolveBoards(
      profileWith({ sources: ["wellfound"] }),
      { path: root },
      { env: OFF },
    );
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.value[0]).toMatchObject({ id: "wellfound" });
    expect(resolved.value[0]?.adapter).toBeUndefined();
    expect(resolved.value[0]?.problem).toBeUndefined();
  });

  test("custom boards join an automatic selection and can be named explicitly", async () => {
    await writeCustomBoards(root, [CUSTOM]);
    expect(await resolveIds({ regions: ["JP"] })).toContain("my-feed");
    expect(await resolveIds({ sources: ["my-feed"] })).toEqual(["my-feed"]);
  });

  test("a malformed custom boards file fails the resolution", async () => {
    writeFileSync(path.join(root, "boards.json"), "{");
    const resolved = await resolveBoards(profileWith({}), { path: root }, { env: OFF });
    expect(resolved).toMatchObject({ ok: false, error: { code: "custom-boards-invalid" } });
  });
});

describe("custom boards", () => {
  test("a missing file reads as an empty list", async () => {
    expect(await readCustomBoards(root)).toEqual({ ok: true, value: [] });
  });

  test("write then read round-trips and writes valid JSON", async () => {
    expect(await writeCustomBoards(root, [CUSTOM])).toEqual({ ok: true, value: undefined });
    const written: unknown = JSON.parse(readFileSync(path.join(root, "boards.json"), "utf8"));
    expect(Array.isArray(written)).toBe(true);
    expect(await readCustomBoards(root)).toEqual({ ok: true, value: [CUSTOM] });
  });

  test("a non-feed or non-rss entry is rejected", async () => {
    await writeCustomBoards(root, [{ ...CUSTOM, access: "manual" }]);
    expect(await readCustomBoards(root)).toMatchObject({
      ok: false,
      error: { code: "custom-boards-invalid" },
    });
    await writeCustomBoards(root, [{ ...CUSTOM, parser: "remotive" }]);
    const result = await readCustomBoards(root);
    expect(result.ok ? "" : result.error.message).toContain("rss parser");
  });

  test("an invalid entry names itself and duplicate ids fail", async () => {
    writeFileSync(path.join(root, "boards.json"), JSON.stringify([CUSTOM, { ...CUSTOM }]));
    const result = await readCustomBoards(root);
    expect(result.ok ? "" : result.error.message).toContain("duplicate id");
  });

  test("a write that cannot replace the file fails with a code", async () => {
    mkdirSync(path.join(root, "boards.json"));
    const blocked = await writeCustomBoards(root, [CUSTOM]);
    expect(blocked).toMatchObject({ ok: false, error: { code: "custom-boards-write-failed" } });
  });
});
