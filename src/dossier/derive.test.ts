import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { isObject } from "../core/narrow.ts";
import { applyDossierBatch, deriveBatch } from "./derive.ts";
import { loadIdentityIfPresent } from "./identity-guard.ts";
import { parseProposal, validateProposal } from "./proposal.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
let dataDir = "";

function context(): CommandContext {
  return { dataDir: { path: dataDir }, env: {}, cwd: dataDir };
}

beforeEach(() => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "jobship-derive-unit-"));
  cpSync(path.join(REPO_ROOT, "fixtures/dossier/complete/dossier"), path.join(dataDir, "dossier"), {
    recursive: true,
  });
  for (const file of ["facts.yaml", "bullets.yaml", "profile.yaml", "never-claim.yaml"]) {
    cpSync(path.join(REPO_ROOT, "templates", file), path.join(dataDir, file));
  }
  writeFileSync(path.join(dataDir, "answers.json"), "[]\n");
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("parseProposal", () => {
  test("rejects a non-object and a fact without cites", () => {
    expect(parseProposal([]).ok).toBe(false);
    const bad = parseProposal({ facts: [{ id: "a", text: "t", source: "cv", cites: [] }] });
    expect(bad.ok).toBe(false);
  });

  test("accepts an empty proposal", () => {
    expect(parseProposal({}).ok).toBe(true);
  });
});

describe("deriveBatch", () => {
  test("an empty proposal yields zero items and applies as a no-op", async () => {
    const proposal = parseProposal({});
    if (!proposal.ok) throw new Error("proposal should parse");
    const derived = await deriveBatch(context(), proposal.value);
    if (!derived.ok) throw new Error(derived.error.message);
    expect(derived.value.items).toEqual([]);
    const applied = await applyDossierBatch(context(), derived.value.batchPath);
    expect(applied).toEqual({ ok: true, value: { applied: 0 } });
  });

  test("a data directory is required", async () => {
    const result = await deriveBatch(
      { dataDir: null, env: {}, cwd: dataDir },
      {
        facts: [],
        bullets: [],
        profile: {},
        neverClaim: [],
        answers: [],
      },
    );
    expect(result.ok).toBe(false);
  });

  test("an unknown fact reference in a bullet is refused", () => {
    const proposal = parseProposal({
      bullets: [{ id: "b", text: "t", tags: [], factIds: ["missing"] }],
    });
    if (!proposal.ok) throw new Error("proposal should parse");
    const checked = validateProposal({ path: dataDir }, proposal.value, []);
    expect(checked.ok).toBe(false);
  });

  test("removing a fact a stored bullet still cites is refused", () => {
    const stored = [{ id: "b-keep", text: "t", tags: [], factIds: ["f-gone"] }];
    const proposal = parseProposal({ removals: { facts: ["f-gone"], bullets: [] } });
    if (!proposal.ok) throw new Error("proposal should parse");
    const checked = validateProposal({ path: dataDir }, proposal.value, ["f-gone"], stored);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.message).toContain("b-keep");
  });

  test("removing a fact with every citing bullet removed is accepted", () => {
    const stored = [{ id: "b-gone", text: "t", tags: [], factIds: ["f-gone"] }];
    const proposal = parseProposal({ removals: { facts: ["f-gone"], bullets: ["b-gone"] } });
    if (!proposal.ok) throw new Error("proposal should parse");
    const checked = validateProposal({ path: dataDir }, proposal.value, ["f-gone"], stored);
    expect(checked.ok).toBe(true);
  });
});

describe("loadIdentityIfPresent", () => {
  test("returns no fields when the Dossier is absent", () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "jobship-no-dossier-"));
    try {
      expect(loadIdentityIfPresent({ path: empty })).toEqual({ ok: true, value: [] });
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

function readDataFile(name: string): string {
  return readFileSync(path.join(dataDir, name), "utf8");
}

function parsedFile(name: string): Record<string, unknown> {
  const parsed: unknown = Bun.YAML.parse(readDataFile(name));
  if (!isObject(parsed)) throw new TypeError(`${name} is not a mapping`);
  return parsed;
}

function listOf(name: string, key: string): unknown[] {
  const list = parsedFile(name)[key];
  return Array.isArray(list) ? Array.from<unknown>(list) : [];
}

function loadBaseProposal(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "fixtures/dossier/proposal.json"), "utf8"),
  );
  if (!isObject(parsed)) throw new TypeError("proposal fixture is not an object");
  return parsed;
}

async function applyProposal(raw: unknown): Promise<string> {
  const proposal = parseProposal(raw);
  if (!proposal.ok) throw new Error(proposal.error.message);
  const derived = await deriveBatch(context(), proposal.value);
  if (!derived.ok) throw new Error(derived.error.message);
  const applied = await applyDossierBatch(context(), derived.value.batchPath);
  if (!applied.ok) throw new Error(applied.error.message);
  return derived.value.batchPath;
}

describe("applyDossierBatch comment preservation", () => {
  const DERIVED_YAML = ["facts.yaml", "bullets.yaml", "profile.yaml", "never-claim.yaml"];
  const COMMENT_LINES = [
    "# Valid names: greenhouse, lever, ashby, workable, smartrecruiters (these need `jobship company add`), getonboard, himalayas, remoteok, hn.",
    "  # Linear only, all optional:",
    "  # states: {lead: Backlog, applied: In Progress}",
    '  # channelLabels: {linkedin: "channel:linkedin"}',
    '  # channelLabelPrefix: "channel:"',
    "  # titleFormat: role-at-company",
  ];

  test("keeps every comment and key order, parses as before, and is idempotent", async () => {
    writeFileSync(path.join(dataDir, "facts.yaml"), "# facts note\nfacts: []\n");
    writeFileSync(path.join(dataDir, "bullets.yaml"), "# bullets note\nbullets: []\n");
    const batchPath = await applyProposal(loadBaseProposal());

    const profileText = readDataFile("profile.yaml");
    for (const line of COMMENT_LINES) expect(profileText).toContain(line);
    expect(readDataFile("facts.yaml")).toContain("# facts note");
    expect(readDataFile("bullets.yaml")).toContain("# bullets note");
    const profile = parsedFile("profile.yaml");
    expect(Object.keys(profile).slice(0, 3)).toEqual(["regions", "contractTypes", "remote"]);
    expect(profile["regions"]).toEqual(["EU"]);
    const factIds = listOf("facts.yaml", "facts").map((fact) => isObject(fact) && fact["id"]);
    expect(factIds).toEqual(["checkout-latency", "ci-pipeline"]);
    expect(listOf("never-claim.yaml", "terms")).toEqual(["Kubernetes certified"]);

    const before = DERIVED_YAML.map(readDataFile);
    const again = await applyDossierBatch(context(), batchPath);
    expect(again).toEqual({ ok: true, value: { applied: 0 } });
    expect(DERIVED_YAML.map(readDataFile)).toEqual(before);
  });

  test("replacing a bullet keeps untouched entries and comments", async () => {
    writeFileSync(path.join(dataDir, "facts.yaml"), "# facts note\nfacts: []\n");
    const base = loadBaseProposal();
    await applyProposal(base);
    const stored: unknown = base["bullets"];
    const candidate: unknown = Array.isArray(stored) ? stored[0] : {};
    const first = isObject(candidate) ? candidate : {};
    const replacement = "Cut checkout latency threefold with a cache";
    await applyProposal({ ...base, bullets: [{ ...first, text: replacement }] });
    const bullets = listOf("bullets.yaml", "bullets");
    expect(bullets).toHaveLength(1);
    expect(isObject(bullets[0]) && bullets[0]["text"]).toBe(replacement);
    expect(readDataFile("facts.yaml")).toContain("# facts note");
  });

  test("removing the first row keeps the comment above the next row", async () => {
    const seeded = [
      "# leading note",
      "facts:",
      "  # about a",
      "  - id: a",
      "    text: A",
      "    tags: []",
      "    source: cv",
      "    cites: [dossier/career.md:10]",
      "  # about b",
      "  - id: b",
      "    text: B",
      "    tags: []",
      "    source: cv",
      "    cites: [dossier/career.md:11]",
      "",
    ].join("\n");
    writeFileSync(path.join(dataDir, "facts.yaml"), seeded);
    await applyProposal({ facts: [], removals: { facts: ["a"], bullets: [] } });
    const text = readDataFile("facts.yaml");
    expect(text).toContain("# about b");
    expect(text).toContain("# leading note");
    expect(text).not.toContain("id: a");
    expect(text).toContain("id: b");
  });

  test("a comment-only derived file keeps its comments", async () => {
    const proposal = parseProposal(loadBaseProposal());
    if (!proposal.ok) throw new Error(proposal.error.message);
    const derived = await deriveBatch(context(), proposal.value);
    if (!derived.ok) throw new Error(derived.error.message);
    writeFileSync(path.join(dataDir, "facts.yaml"), "# my notes\n");
    const applied = await applyDossierBatch(context(), derived.value.batchPath);
    expect(applied.ok).toBe(true);
    expect(readDataFile("facts.yaml")).toContain("# my notes");
    expect(listOf("facts.yaml", "facts")).toHaveLength(2);
  });

  test("a missing derived file starts from an empty document", async () => {
    rmSync(path.join(dataDir, "never-claim.yaml"));
    await applyProposal(loadBaseProposal());
    expect(listOf("never-claim.yaml", "terms")).toEqual(["Kubernetes certified"]);
  });
});
