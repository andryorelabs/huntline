import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { readEvents } from "../ledger/events.ts";
import { foldState } from "../ledger/state.ts";
import { importLegacy } from "./legacy.ts";
import { splitCompanyRole } from "./title.ts";

let root = "";
let legacyDir = "";
let ctx: CommandContext;

const SWEEP = `# Sweep 2026-04-01

| Company | Portal | Cards | Units |
| --- | --- | --- | --- |
| Acme Corp | greenhouse | 3 | 2 |

## Leads

### Acme Corp - Backend Engineer

- **URL:** https://example.test/jobs/77
- **Company:** Acme Corp
- **Role:** Backend Engineer
- **Fit:** B
- **Posted:** 2026-03-30
- **Salary:** 60k-70k EUR
- **Stack:** Go, Postgres
- **Contract:** full-time
- **Source portal:** greenhouse
`;

const REVIEW = `| ID | Title | Status | Evidence | Rule check | Verdict | Reason | Fit | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AO-7 | Acme Corp - Backend Engineer | Backlog | posting | pass | cancel | stack mismatch | B | P2 |
| AO-8 | Globex - Platform Engineer | Backlog | posting | pass | keep | good fit | A | P1 |
| AO-9 | Initech - Data Engineer | Backlog | posting | pass | maybe-later | unsure | C | P3 |
`;

const BATCH = `| Rank | Lead | ID | Title | Channel | Outcome | CV | Salary | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | x | [AO-7](https://linear.example.test/AO-7) | Acme Corp - Backend Engineer | email | applied | v1 | - | - | sent |
| 2 | x | [AO-8](https://linear.example.test/AO-8) | Globex - Platform Engineer | portal | needs-human | v1 | - | - | captcha |
| 3 | x | [AO-10](https://linear.example.test/AO-10) | Hooli - SRE | portal | teleported | v1 | - | - | |
`;

const FOLLOWUP = `| Rank | Lead | ID | Title | Channel | Outcome | CV | Salary | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | x | [AO-7](https://linear.example.test/AO-7) | Acme Corp - Backend Engineer | email | cancelled | v1 | - | - | withdrawn |
`;

function write(relative: string, content: string): void {
  const target = path.join(legacyDir, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function dir(): { path: string } {
  return ctx.dataDir ?? { path: "" };
}

async function stateOf(prefix: string): Promise<string | null> {
  const events = await readEvents(dir());
  return foldState(events.filter((event) => event.key?.startsWith(prefix)));
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jobship-legacy-"));
  legacyDir = path.join(root, "legacy");
  const dataPath = path.join(root, "data");
  mkdirSync(dataPath);
  ctx = { dataDir: { path: dataPath }, env: {}, cwd: root };
  write("sweeps/2026-04-01/run.md", SWEEP);
  write("sweeps/2026-04-01/README.md", "| X | Y |\n| - | - |\n| a | b |\n");
  write("reviews/2026-04-02/batch-1.md", REVIEW);
  write("applications/2026-04-03/batch-1.md", BATCH);
  write("applications/2026-04-04/followup-1.md", FOLLOWUP);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("splitCompanyRole", () => {
  test("splits on the first separator", () => {
    expect(splitCompanyRole("Acme - Backend - Senior")).toEqual({
      company: "Acme",
      role: "Backend - Senior",
    });
    expect(splitCompanyRole("Solo")).toEqual({ company: "", role: "Solo" });
  });
});

describe("importLegacy real layout", () => {
  test("follow-up overrides the batch outcome and the Lead is created once", async () => {
    const result = await importLegacy(ctx, legacyDir);
    if (!result.ok) throw new Error(result.error.message);
    const events = await readEvents(dir());
    const acme = events.filter((event) => event.key?.startsWith("acme"));
    expect(acme.filter((event) => event.kind === "lead.created")).toHaveLength(1);
    expect(await stateOf("acme")).toBe("discarded");
    expect(await stateOf("globex")).toBe("to-apply");
  });

  test("sweep lead heading carries its fields", async () => {
    await importLegacy(ctx, legacyDir);
    const events = await readEvents(dir());
    const lead = events.find(
      (event) => event.kind === "lead.created" && event.posting.company === "Acme Corp",
    );
    if (lead?.kind !== "lead.created") throw new Error("missing lead");
    expect(lead.posting.url).toBe("https://example.test/jobs/77");
    expect(lead.posting.title).toBe("Backend Engineer");
    expect(lead.posting.source).toBe("greenhouse");
    expect(lead.posting.contract).toBe("full-time");
    expect(lead.posting.stack).toEqual(["Go", "Postgres"]);
    expect(lead.posting.postedAt).toBe("2026-03-30");
  });

  test("needs-human adds a note without changing state", async () => {
    await importLegacy(ctx, legacyDir);
    const events = await readEvents(dir());
    expect(
      events.some((event) => event.kind === "note" && event.text.includes("needs-human")),
    ).toBe(true);
    expect(await stateOf("globex")).toBe("to-apply");
  });

  test("reports unknown verdicts and outcomes", async () => {
    const result = await importLegacy(ctx, legacyDir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.unknownStates).toContain('review verdict "maybe-later" in batch-1.md');
    expect(result.value.unknownStates).toContain('application outcome "teleported" in batch-1.md');
  });

  test("skips README files", async () => {
    const result = await importLegacy(ctx, legacyDir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.some((warning) => warning.includes("README"))).toBe(false);
  });

  test("running twice leaves the event count unchanged", async () => {
    await importLegacy(ctx, legacyDir);
    const before = (await readEvents(dir())).length;
    const second = await importLegacy(ctx, legacyDir);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.created).toBe(0);
    expect((await readEvents(dir())).length).toBe(before);
  });

  test("warns about tables without a company or title column", async () => {
    write("sweeps/2026-04-05/odd.md", "| X | Y |\n| --- | --- |\n| 1 | 2 |\n");
    const result = await importLegacy(ctx, legacyDir);
    if (!result.ok) throw new Error(result.error.message);
    const warning = result.value.warnings.find((entry) => entry.includes("odd.md"));
    expect(warning).toContain("X");
    expect(warning).toContain("Y");
  });

  test("warns about files with no parseable content", async () => {
    write("reviews/2026-04-06/empty.md", "# Nothing here\n\njust prose\n");
    const result = await importLegacy(ctx, legacyDir);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.some((entry) => entry.includes("empty.md"))).toBe(true);
  });
});

function isolated(files: Record<string, string>): string {
  const target = path.join(root, "isolated");
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(target, name)), { recursive: true });
    writeFileSync(path.join(target, name), content);
  }
  return target;
}

describe("coverage and lead-outcome tables", () => {
  const COVERAGE = `| Portal | Status | Counts | Note |
| --- | --- | --- | --- |
| greenhouse | done | 3 | ok |

| Unit | Kind | Status | Counts |
| --- | --- | --- | --- |
| u1 | board | done | 2 |

| Card | Source file | Status | Counts |
| --- | --- | --- | --- |
| c1 | cards.md | done | 5 |
`;
  const LEADS = `| Lead | Linear | Outcome | Detail |
| --- | --- | --- | --- |
| Acme Corp - Backend Engineer | AO-7 | applied | sent by email |
`;

  test("skips the three coverage tables without warnings or events", async () => {
    const result = await importLegacy(ctx, isolated({ "sweeps/2026-05-01/cover.md": COVERAGE }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.filter((warning) => warning.includes("recognised"))).toEqual([]);
    expect(await readEvents(dir())).toHaveLength(0);
  });

  test("a partly matching coverage table still warns", async () => {
    const partial =
      "| Portal | Status | Counts | Extra |\n| --- | --- | --- | --- |\n| a | b | c | d |\n";
    const result = await importLegacy(ctx, isolated({ "sweeps/2026-05-01/cover.md": partial }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.some((warning) => warning.includes("recognised"))).toBe(true);
  });

  test("imports a Lead, Linear, Outcome, Detail row as an application", async () => {
    const target = isolated({ "applications/2026-05-02/leads.md": LEADS });
    const first = await importLegacy(ctx, target);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.warnings).toEqual([]);
    expect(await stateOf("acme")).toBe("applied");
    const events = await readEvents(dir());
    const texts = events.flatMap((event) => (event.kind === "note" ? [event.text] : []));
    expect(texts).toContain("legacy id AO-7");
    expect(texts.some((text) => text.includes("sent by email"))).toBe(true);
    const second = await importLegacy(ctx, target);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.created).toBe(0);
  });

  test("reports an unknown outcome as an unknown state", async () => {
    const odd = LEADS.replace("applied", "teleported");
    const result = await importLegacy(ctx, isolated({ "applications/2026-05-02/leads.md": odd }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.unknownStates).toHaveLength(1);
  });
});
