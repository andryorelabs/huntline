import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "./command.ts";
import { scaffoldPrepPack, validatePrepPack, type FactIndex } from "./pack.ts";

const facts: FactIndex = {
  facts: [
    { id: "f-api", text: "Built a billing API", tags: [] },
    { id: "f-ops", text: "Cut deploy time", tags: [] },
  ],
};

function context(dataRoot: string) {
  return { dataDir: { path: dataRoot }, env: {}, cwd: dataRoot };
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "interview-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("prep pack", () => {
  test("scaffold references only existing fact ids", () => {
    const created = scaffoldPrepPack({ path: root }, "acme-dev", facts);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const markdown = readFileSync(created.value, "utf8");
    expect(markdown).toContain("- Facts: f-api");
    expect(validatePrepPack(markdown, facts)).toEqual([]);
  });

  test("refuses to overwrite and unsafe keys", () => {
    scaffoldPrepPack({ path: root }, "acme-dev", facts);
    const again = scaffoldPrepPack({ path: root }, "acme-dev", facts);
    expect(!again.ok && again.error.code).toBe("already-exists");
    expect(scaffoldPrepPack({ path: root }, "   ", facts).ok).toBe(false);
  });

  test("lead keys with separators scaffold inside the prep directory", () => {
    for (const key of ["greenhouse:1001", "acme|senior backend engineer|latam", "../x"]) {
      const created = scaffoldPrepPack({ path: root }, key, facts);
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(path.dirname(created.value)).toBe(path.join(root, "prep"));
      expect(validatePrepPack(readFileSync(created.value, "utf8"), facts)).toEqual([]);
    }
  });

  test("unknown fact id is a finding", () => {
    const created = scaffoldPrepPack({ path: root }, "k", facts);
    if (!created.ok) throw new Error("scaffold failed");
    const broken = readFileSync(created.value, "utf8").replace("- Facts: f-api", "- Facts: f-nope");
    expect(validatePrepPack(broken, facts).map((finding) => finding.rule)).toEqual([
      "unknown-fact",
    ]);
  });
});

describe("interview command", () => {
  test("pack then check passes; edited pack fails", async () => {
    writeFileSync(
      path.join(root, "facts.yaml"),
      "facts:\n  - id: f-api\n    text: Built a billing API\n",
    );
    expect((await run(["pack", "acme"], context(root))).ok).toBe(true);
    expect((await run(["check", "acme"], context(root))).ok).toBe(true);
    const file = path.join(root, "prep", "acme.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("- Facts: f-api", "- Facts: ghost"));
    const checked = await run(["check", "acme"], context(root));
    expect(!checked.ok && checked.error.code).toBe("pack-invalid");
  });

  test("usage errors", async () => {
    expect((await run(["pack"], context(root))).ok).toBe(false);
    expect((await run(["nope"], context(root))).ok).toBe(false);
  });
});
