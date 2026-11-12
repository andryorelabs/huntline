import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DOSSIER_TEMPLATES,
  dossierLineExists,
  loadDossier,
  loadIdentityFields,
  type DossierSectionName,
  type DossierSource,
  type IdentityTier,
  type SectionStatus,
} from "./dossier.ts";

const FIXTURES = path.resolve(import.meta.dir, "../../fixtures/dossier");
const SECTION_NAMES: readonly DossierSectionName[] = ["career", "search", "presence", "identity"];

let root = "";
let dir = { path: "" };

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jobship-dossier-"));
  dir = { path: root };
  cpSync(path.join(FIXTURES, "complete", "dossier"), path.join(root, "dossier"), {
    recursive: true,
  });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(name: string, text: string): void {
  writeFileSync(path.join(root, "dossier", name), text);
}

function errorOf(result: ReturnType<typeof loadDossier>): { code: string; message: string } {
  if (result.ok) throw new Error("expected a failure");
  return result.error;
}

const STATUS_ORDER: readonly SectionStatus[] = ["empty", "partial", "complete"];
const SOURCE_ORDER: readonly DossierSource[] = ["cv", "github", "linkedin", "interview", "export"];
const TIER_ORDER: readonly IdentityTier[] = ["A", "B", "C", "D"];

describe("vocabulary", () => {
  test("lists statuses, sources and tiers", () => {
    expect([STATUS_ORDER.length, SOURCE_ORDER.length, TIER_ORDER.length]).toEqual([3, 5, 4]);
  });
});

describe("loadDossier", () => {
  test("loads the complete fixture", () => {
    const result = loadDossier(dir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.map((section) => section.name)).toEqual([...SECTION_NAMES]);
    expect(result.value.every((section) => section.status === "complete")).toBe(true);
    expect(result.value[0]?.sources).toEqual(["cv", "interview"]);
  });

  test("loads the partial fixture", () => {
    rmSync(path.join(root, "dossier"), { recursive: true });
    cpSync(path.join(FIXTURES, "partial", "dossier"), path.join(root, "dossier"), {
      recursive: true,
    });
    const result = loadDossier(dir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.map((section) => section.status)).toEqual([
      "complete",
      "partial",
      "empty",
      "empty",
    ]);
  });

  test("scaffold templates parse as empty sections", () => {
    rmSync(path.join(root, "dossier"), { recursive: true });
    mkdirSync(path.join(root, "dossier"));
    for (const [file, text] of Object.entries(DOSSIER_TEMPLATES)) {
      writeFileSync(path.join(root, file), text);
    }
    const result = loadDossier(dir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.every((section) => section.status === "empty")).toBe(true);
    expect(Object.values(DOSSIER_TEMPLATES).join("")).not.toContain("TODO(jobship):");
  });

  test("accepts a BOM and CRLF line endings", () => {
    write(
      "search.md",
      "﻿---\r\nstatus: partial\r\nsources: [cv]\r\n---\r\n\r\n- a (source: cv)\r\n",
    );
    const result = loadDossier(dir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value[1]?.status).toBe("partial");
  });

  test("rejects an empty file", () => {
    write("search.md", "");
    const error = errorOf(loadDossier(dir));
    expect(error.code).toBe("dossier-invalid");
    expect(error.message).toContain("dossier/search.md");
  });

  test("rejects missing and unterminated front matter", () => {
    write("search.md", "# Search\n");
    expect(errorOf(loadDossier(dir)).message).toContain("front matter");
    write("search.md", "---\nstatus: empty\nsources: []\n");
    expect(errorOf(loadDossier(dir)).message).toContain("front matter");
  });

  test("rejects malformed YAML front matter", () => {
    write("search.md", "---\nstatus: [oops\n---\n");
    const error = errorOf(loadDossier(dir));
    expect(error.message).toContain("dossier/search.md");
    expect(error.message).toContain("malformed front matter");
  });

  test("rejects unknown status and unknown source", () => {
    write("search.md", "---\nstatus: done\nsources: []\n---\n");
    expect(errorOf(loadDossier(dir)).message).toContain("unknown status");
    write("search.md", "---\nstatus: empty\nsources: [fax]\n---\n");
    expect(errorOf(loadDossier(dir)).message).toContain("unknown source");
  });

  test("rejects an unknown section file and a missing one", () => {
    write("hobbies.md", "---\nstatus: empty\nsources: []\n---\n");
    expect(errorOf(loadDossier(dir)).message).toContain("dossier/hobbies.md");
    rmSync(path.join(root, "dossier", "hobbies.md"));
    rmSync(path.join(root, "dossier", "presence.md"));
    expect(errorOf(loadDossier(dir)).message).toContain("dossier/presence.md");
  });

  test("ignores the batches directory", () => {
    mkdirSync(path.join(root, "dossier", "batches"));
    expect(loadDossier(dir).ok).toBe(true);
  });

  test("rejects a tier C field holding anything but readiness", () => {
    write("identity.md", "---\nstatus: complete\nsources: []\n---\n\n- passportNumber [C]: X123\n");
    const error = errorOf(loadDossier(dir));
    expect(error.code).toBe("dossier-invalid");
    expect(error.message).toContain("dossier/identity.md");
    write(
      "identity.md",
      "---\nstatus: complete\nsources: []\n---\n\n- passportNumber [C]: ready: yes\n",
    );
    expect(loadDossier(dir).ok).toBe(true);
  });

  test("accepts block-style sources in the identity front matter", () => {
    write(
      "identity.md",
      "---\nstatus: complete\nsources:\n  - interview\n---\n\n- fullName [A]: Jane Doe\n",
    );
    expect(loadDossier(dir).ok).toBe(true);
  });

  test("rejects tier C values on any bullet style or without a bullet", () => {
    for (const line of ["passportNumber [C]: X123", "* idNumber [C]: Y999", "-\tssn [C]: 123"]) {
      write("identity.md", `---\nstatus: complete\nsources: []\n---\n\n${line}\n`);
      expect(errorOf(loadDossier(dir)).code).toBe("dossier-invalid");
    }
  });

  test("rejects a malformed identity field", () => {
    write("identity.md", "---\nstatus: complete\nsources: []\n---\n\n- fullName: Jane\n");
    expect(errorOf(loadDossier(dir)).message).toContain("malformed identity field");
  });
});

describe("loadIdentityFields", () => {
  test("returns name, tier, value and 1-based line", () => {
    const result = loadIdentityFields(dir);
    if (!result.ok) throw new Error(result.error.message);
    const street = result.value.find((field) => field.name === "streetAddress");
    expect(street).toEqual({ name: "streetAddress", tier: "A", value: "123 Example St", line: 12 });
    expect(result.value.find((field) => field.name === "passportNumber")?.value).toBe("ready: yes");
  });

  test("skips field examples inside the template comment", () => {
    write("identity.md", DOSSIER_TEMPLATES["dossier/identity.md"] ?? "");
    const result = loadIdentityFields(dir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toEqual([]);
  });
});

describe("dossierLineExists", () => {
  test("counts lines from 1 including front matter", () => {
    expect(dossierLineExists(dir, "dossier/career.md:1")).toBe(true);
    expect(dossierLineExists(dir, "dossier/career.md:8")).toBe(true);
    expect(dossierLineExists(dir, "dossier/career.md:5")).toBe(false);
  });

  test("rejects out of range, zero and malformed refs", () => {
    expect(dossierLineExists(dir, "dossier/career.md:999")).toBe(false);
    expect(dossierLineExists(dir, "dossier/career.md:0")).toBe(false);
    expect(dossierLineExists(dir, "dossier/unknown.md:1")).toBe(false);
    expect(dossierLineExists(dir, "career.md:1")).toBe(false);
  });
});
