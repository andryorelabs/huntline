import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
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
