import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "../core/commands.ts";
import { run } from "./command.ts";

const CAREERS_URL = "https://boards.greenhouse.io/acme";

let root = "";

function context(): CommandContext {
  return { dataDir: { path: root }, env: {}, cwd: root };
}

function withoutDataDir(): CommandContext {
  return { dataDir: null, env: {}, cwd: root };
}

function errorCode(envelope: Awaited<ReturnType<typeof run>>): string | null {
  return envelope.ok ? null : envelope.error.code;
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jobship-company-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("company add", () => {
  test("stores a detected company and reports it as added", async () => {
    const result = await run(["add", CAREERS_URL], context());
    expect(result).toEqual({
      ok: true,
      data: { added: true, company: { ats: "greenhouse", slug: "acme" } },
    });
    const stored: unknown = JSON.parse(readFileSync(path.join(root, "companies.json"), "utf8"));
    expect(stored).toEqual({ companies: [{ ats: "greenhouse", slug: "acme" }] });
  });

  test("does not store the same company twice", async () => {
    await run(["add", CAREERS_URL], context());
    const second = await run(["add", CAREERS_URL], context());
    expect(second).toEqual({
      ok: true,
      data: { added: false, company: { ats: "greenhouse", slug: "acme" } },
    });
    const listed = await run(["list"], context());
    expect(listed).toEqual({
      ok: true,
      data: { companies: [{ ats: "greenhouse", slug: "acme" }] },
    });
  });

  test("rejects a URL with no supported ATS", async () => {
    const result = await run(["add", "https://example.com/careers"], context());
    expect(errorCode(result)).toBe("unsupported-careers-url");
  });

  test.each([[["add"]], [["add", CAREERS_URL, "extra"]]])(
    "rejects the arguments %j",
    async (argv) => {
      expect(errorCode(await run(argv, context()))).toBe("usage");
    },
  );

  test("needs a data directory", async () => {
    expect(errorCode(await run(["add", CAREERS_URL], withoutDataDir()))).toBe("data-dir-not-found");
  });

  test("reports a malformed companies file instead of overwriting it", async () => {
    writeFileSync(path.join(root, "companies.json"), '{"companies":[{"ats":"greenhouse"}]}');
    const result = await run(["add", CAREERS_URL], context());
    expect(errorCode(result)).toBe("companies-malformed");
    expect(readFileSync(path.join(root, "companies.json"), "utf8")).toBe(
      '{"companies":[{"ats":"greenhouse"}]}',
    );
  });
});

describe("company list", () => {
  test("lists nothing when no company was added", async () => {
    expect(await run(["list"], context())).toEqual({ ok: true, data: { companies: [] } });
  });

  test("reports a companies file that is not valid JSON", async () => {
    writeFileSync(path.join(root, "companies.json"), "not json");
    expect(errorCode(await run(["list"], context()))).toBe("companies-malformed");
  });

  test("reports a companies file without a companies array", async () => {
    writeFileSync(path.join(root, "companies.json"), '{"companies":"acme"}');
    expect(errorCode(await run(["list"], context()))).toBe("companies-malformed");
  });

  test("rejects extra arguments", async () => {
    expect(errorCode(await run(["list", "extra"], context()))).toBe("usage");
  });

  test("needs a data directory", async () => {
    expect(errorCode(await run(["list"], withoutDataDir()))).toBe("data-dir-not-found");
  });
});

describe("company", () => {
  test.each([[[]], [["remove"]]])("rejects the subcommand %j", async (argv) => {
    expect(errorCode(await run(argv, context()))).toBe("usage");
  });
});
