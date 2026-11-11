import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { isObject } from "../core/narrow.ts";
import { resolveTypst } from "../core/tools.ts";
import type { DataDir } from "../core/types.ts";
import { buildCv, systemRunner, type TypstRunner } from "./build.ts";
import { runWith } from "./command.ts";
import { loadBullets, loadFactBank, loadNeverClaim, loadVariants } from "./facts.ts";
import { lintCv } from "./lint.ts";
import { requirementCoverage, selectBullets } from "./select.ts";
import type { FactBank } from "./types.ts";

const examples = path.join(import.meta.dir, "../../examples/cv");
let root = "";
let dir: DataDir = { path: "" };

function payloadOf(runner: { compiled: string[] }): Record<string, unknown> {
  const parsed: unknown = JSON.parse(runner.compiled[0] ?? "{}");
  if (!isObject(parsed)) throw new Error("compiled payload is not an object");
  return parsed;
}

function idsOf(list: unknown): unknown[] {
  if (!Array.isArray(list)) throw new Error("expected a list");
  return list.map((item: unknown) => (isObject(item) ? item["id"] : undefined));
}

function fakeRunner(text: string): TypstRunner & { compiled: string[] } {
  const compiled: string[] = [];
  return {
    compiled,
    compile(request) {
      compiled.push(readFileSync(request.dataFile, "utf8"));
      return Promise.resolve({ ok: true, value: undefined });
    },
    extractText() {
      return Promise.resolve({ ok: true, value: text });
    },
  };
}

function context(): CommandContext {
  return { dataDir: dir, env: {}, cwd: root };
}

function ctx() {
  const facts = loadFactBank(dir);
  if (!facts.ok) throw new Error("load failed");
  return { facts: facts.value, neverClaim: ["Kubernetes", "team lead"] };
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jobship-cv-"));
  dir = { path: root };
  for (const file of ["facts.yaml", "bullets.yaml", "never-claim.yaml"]) {
    cpSync(path.join(examples, file), path.join(root, file));
  }
  mkdirSync(path.join(root, "cv"));
  cpSync(path.join(examples, "template.typ"), path.join(root, "cv", "template.typ"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("loading", () => {
  test("loads example data", () => {
    const facts = loadFactBank(dir);
    const bullets = loadBullets(dir);
    const terms = loadNeverClaim(dir);
    expect(facts.ok && facts.value.facts.length).toBe(3);
    expect(bullets.ok && bullets.value.length).toBe(3);
    expect(terms.ok && terms.value).toContain("Kubernetes");
  });

  test("empty templates load as empty lists", () => {
    writeFileSync(path.join(root, "facts.yaml"), "facts: []\n");
    const facts = loadFactBank(dir);
    expect(facts.ok && facts.value.facts).toEqual([]);
  });
});

describe("selectBullets", () => {
  test("filters by tag and never adds", () => {
    const bullets = loadBullets(dir);
    if (!bullets.ok) throw new Error("load failed");
    const selected = selectBullets(bullets.value, { tags: ["devops"] });
    expect(selected.map((bullet) => bullet.id)).toEqual(["b-ci"]);
    for (const bullet of selected) expect(bullets.value).toContain(bullet);
  });

  test("filters by requirement text", () => {
    const bullets = loadBullets(dir);
    if (!bullets.ok) throw new Error("load failed");
    const selected = selectBullets(bullets.value, { requirements: ["GitHub Actions"] });
    expect(selected.map((bullet) => bullet.id)).toEqual(["b-ci"]);
  });
});

describe("requirementCoverage", () => {
  test("reports missing requirements", () => {
    const facts = loadFactBank(dir);
    if (!facts.ok) throw new Error("load failed");
    const coverage = requirementCoverage(["TypeScript", "Kubernetes"], facts.value);
    expect(coverage.covered).toEqual([{ requirement: "TypeScript", factIds: ["f-api-latency"] }]);
    expect(coverage.missing).toEqual(["Kubernetes"]);
  });
});

describe("buildCv", () => {
  test("builds with the runner and writes JSON, pdf path and text", async () => {
    const runner = fakeRunner("Reduced checkout API p95 latency from 900 ms to 300 ms.");
    const result = await buildCv(dir, { name: "backend", tags: ["backend"], runner });
    expect(result.ok).toBe(true);
    const payload: unknown = JSON.parse(runner.compiled[0] ?? "{}");
    expect(payload).toMatchObject({ variant: "backend", bullets: [{ id: "b-latency" }] });
    if (result.ok) expect(existsSync(result.value.text)).toBe(true);
  });

  test("rejects a variant name that escapes the output directory", async () => {
    const runner = fakeRunner("x");
    const result = await buildCv(dir, { name: "../../escape", runner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-variant");
    expect(runner.compiled).toHaveLength(0);
  });

  test("fails naming the Bullet whose fact id is missing", async () => {
    writeFileSync(
      path.join(root, "bullets.yaml"),
      "bullets:\n  - id: b-ghost\n    text: Did a thing.\n    tags: [x]\n    facts: [f-nope]\n",
    );
    const result = await buildCv(dir, { runner: fakeRunner("") });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("b-ghost");
      expect(result.error.message).toContain("f-nope");
    }
  });

  test("cv build exits 1 through the command", async () => {
    writeFileSync(
      path.join(root, "bullets.yaml"),
      "bullets:\n  - id: b-ghost\n    text: Did a thing.\n    tags: []\n    facts: [f-nope]\n",
    );
    const envelope = await runWith(["build"], context(), fakeRunner(""));
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) expect(envelope.error.message).toContain("b-ghost");
  });
});

describe("lintCv", () => {
  test("flags never-claim terms case-insensitively with location", () => {
    const findings = lintCv("Built things\nran KUBERNETES clusters", ctx());
    const hit = findings.find((finding) => finding.rule === "never-claim");
    expect(hit).toMatchObject({ term: "Kubernetes", line: 2, column: 5 });
  });

  test("does not flag a term inside a longer word", () => {
    const findings = lintCv("Kubernetesque things", ctx());
    expect(findings.some((finding) => finding.rule === "never-claim")).toBe(false);
  });

  test("flags repeated phrases, unbacked numbers and placeholders", () => {
    const text =
      "Improved the checkout API quickly. Improved the checkout API again. Served 5000 users. TODO(jobship): fix";
    const rules = lintCv(text, ctx()).map((finding) => finding.rule);
    expect(rules).toContain("repeated-phrase");
    expect(rules).toContain("unbacked-number");
    expect(rules).toContain("placeholder");
  });

  test("backed numbers pass", () => {
    const findings = lintCv("Cut latency from 900 ms to 300 ms for 12 services.", ctx());
    expect(findings).toEqual([]);
  });

  test("cv lint exits 1 naming term and location", async () => {
    mkdirSync(path.join(root, "cv", "out"), { recursive: true });
    writeFileSync(path.join(root, "cv", "out", "cv.txt"), "Led a team lead program\n");
    const envelope = await runWith(["lint"], context(), fakeRunner(""));
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe("lint-failed");
      expect(envelope.error.message).toContain("team lead");
      expect(envelope.error.message).toContain("line 1");
    }
  });
});

describe("cv coverage command", () => {
  test("lists missing requirements", async () => {
    const envelope = await runWith(
      ["coverage", "lead-1", "--requirement", "Kubernetes", "--requirement", "typescript"],
      context(),
      fakeRunner(""),
    );
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data).toMatchObject({ key: "lead-1", missing: ["Kubernetes"] });
    }
  });
});

describe("requirementCoverage significant words", () => {
  const bank: FactBank = {
    facts: [{ id: "f-react", text: "Built dashboards at Acme", tags: ["react"] }],
  };

  test("matches a phrase on a significant word equal to a tag", () => {
    expect(requirementCoverage(["3+ years React"], bank).covered).toEqual([
      { requirement: "3+ years React", factIds: ["f-react"] },
    ]);
  });

  test("a stop-word tag never covers a phrase", () => {
    const tagged: FactBank = {
      facts: [
        { id: "f-experience", text: "Shipped features at Initech", tags: ["experience", "years"] },
      ],
    };
    expect(requirementCoverage(["3+ years experience with Go"], tagged).missing).toEqual([
      "3+ years experience with Go",
    ]);
  });

  test("allowlisted short tokens are significant", () => {
    const tagged: FactBank = {
      facts: [
        { id: "f-go", text: "Wrote tooling at Globex", tags: ["go"] },
        { id: "f-cpp", text: "Built engines at Initech", tags: ["c++"] },
      ],
    };
    expect(requirementCoverage(["Strong Go experience"], tagged).covered).toEqual([
      { requirement: "Strong Go experience", factIds: ["f-go"] },
    ]);
    expect(requirementCoverage(["Modern C++ and Rust"], tagged).covered).toEqual([
      { requirement: "Modern C++ and Rust", factIds: ["f-cpp"] },
    ]);
  });

  test("stop words and other short tags stay missing", () => {
    const tagged: FactBank = {
      facts: [
        { id: "f-to", text: "Wrote tooling at Globex", tags: ["to"] },
        { id: "f-c", text: "Built engines at Initech", tags: ["c"] },
      ],
    };
    expect(requirementCoverage(["to be a team player"], tagged).missing).toEqual([
      "to be a team player",
    ]);
    expect(requirementCoverage(["C-level communication"], tagged).missing).toEqual([
      "C-level communication",
    ]);
  });

  test("stop-words and short tokens stay missing", () => {
    expect(requirementCoverage(["3+ years experience with Go"], bank).missing).toEqual([
      "3+ years experience with Go",
    ]);
  });
});

const hasTypst = resolveTypst(process.env) !== null && Bun.which("pdftotext") !== null;

describe("real typst", () => {
  test.skipIf(!hasTypst)("compiles and extracts text", async () => {
    const result = await buildCv(dir, { name: "backend", runner: systemRunner });
    expect(result.ok ? "ok" : result.error.message).toBe("ok");
    if (result.ok) expect(readFileSync(result.value.text, "utf8")).toContain("checkout API");
  });
});

function writeBullets(body: string): void {
  writeFileSync(path.join(root, "bullets.yaml"), body);
}

describe("variants", () => {
  const tagged = `bullets:
  - id: b-both
    text: Did enterprise work.
    tags: [en, enterprise]
    facts: [f-api-latency]
  - id: b-en
    text: Did startup work.
    tags: [en]
    facts: [f-api-latency]
variants:
  startup:
    all: [en]
    none: [enterprise]
`;

  test("loadVariants reads rules and defaults to none", () => {
    writeBullets(tagged);
    const variants = loadVariants(dir);
    expect(variants.ok && variants.value).toEqual([
      { name: "startup", all: ["en"], none: ["enterprise"] },
    ]);
    writeBullets("bullets: []\n");
    const empty = loadVariants(dir);
    expect(empty.ok && empty.value).toEqual([]);
  });

  test("selectBullets applies all, any and none", () => {
    writeBullets(tagged);
    const bullets = loadBullets(dir);
    if (!bullets.ok) throw new Error("load failed");
    const ids = (rule: Parameters<typeof selectBullets>[1]) =>
      selectBullets(bullets.value, rule).map((bullet) => bullet.id);
    expect(ids({ all: ["en"], none: ["enterprise"] })).toEqual(["b-en"]);
    expect(ids({ any: ["enterprise", "x"] })).toEqual(["b-both"]);
    expect(ids({ all: ["en", "enterprise"] })).toEqual(["b-both"]);
  });

  test("cv build --variant applies the rule from the data dir", async () => {
    writeBullets(tagged);
    const runner = fakeRunner("x");
    const envelope = await runWith(["build", "--variant", "startup"], context(), runner);
    expect(envelope.ok).toBe(true);
    expect(idsOf(payloadOf(runner)["bullets"])).toEqual(["b-en"]);
  });

  test("an undefined variant is rejected when variants exist and no tag is given", async () => {
    writeBullets(tagged);
    const result = await buildCv(dir, { name: "nope", runner: fakeRunner("") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unknown-variant");
  });
});

describe("CV structure", () => {
  test("a facts.yaml with only facts builds with an empty structure", async () => {
    writeFileSync(
      path.join(root, "facts.yaml"),
      "facts:\n  - id: f-api-latency\n    text: Cut latency.\n    tags: []\n",
    );
    writeBullets(
      "bullets:\n  - id: b-x\n    text: Did.\n    tags: []\n    facts: [f-api-latency]\n",
    );
    const loaded = loadFactBank(dir);
    expect(loaded.ok && "profile" in loaded.value).toBe(false);
    const runner = fakeRunner("x");
    const result = await buildCv(dir, { runner });
    expect(result.ok).toBe(true);
    const payload = payloadOf(runner);
    expect(payload["experience"]).toEqual([]);
    expect(payload["skills"]).toEqual([]);
  });

  test("groups Bullets by Entry sorted by order and keeps flat bullets", async () => {
    const runner = fakeRunner("x");
    const result = await buildCv(dir, { name: "backend", runner });
    expect(result.ok).toBe(true);
    const payload = payloadOf(runner);
    const header = payload["header"];
    expect(isObject(header) ? header["name"] : undefined).toBe("Jane Example");
    const experience: unknown = payload["experience"];
    const firstEntry: unknown = Array.isArray(experience) ? experience[0] : undefined;
    expect(isObject(firstEntry) ? firstEntry["dates"] : undefined).toBe("Spring to Autumn");
    expect(idsOf(isObject(firstEntry) ? firstEntry["bullets"] : undefined)).toEqual([
      "b-ci",
      "b-latency",
    ]);
    expect(idsOf(payload["bullets"])).toEqual(["b-latency", "b-ci"]);
  });

  test("fails naming a Bullet whose entry is missing", async () => {
    writeBullets(
      "bullets:\n  - id: b-x\n    text: Did.\n    tags: []\n    facts: [f-api-latency]\n    entry: e-ghost\n",
    );
    const result = await buildCv(dir, { runner: fakeRunner("") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("e-ghost");
  });
});
