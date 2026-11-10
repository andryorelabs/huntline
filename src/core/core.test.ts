import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { approvalHash, IdempotencyMap } from "./approval.ts";
import { COMMANDS, resolveCommand } from "./commands.ts";
import { loadProfile, resolveDataDir } from "./data-dir.ts";
import { exitCodeFor, failure, success } from "./envelope.ts";
import { withLock, writeAtomic } from "./fs.ts";
import { validateProfile } from "./profile.ts";
import { CONTRACT_TYPES } from "./types.ts";

let workDir = "";

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "huntline-core-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const validProfile = {
  regions: ["LATAM"],
  contractTypes: ["full-time"],
  remote: "remote-only",
  stack: { include: ["typescript"], exclude: [] },
  salaryFloor: { amount: 50000, currency: "USD" },
  excludedCompanies: [],
  outreachDailyCap: 5,
  sources: ["greenhouse"],
  tracker: { kind: "local" },
};

describe("envelope", () => {
  test("maps error codes to the exit-code contract", () => {
    expect(exitCodeFor(success(1))).toBe(0);
    expect(exitCodeFor(failure("not-implemented", "x"))).toBe(1);
    expect(exitCodeFor(failure("profile-malformed", "x"))).toBe(2);
    expect(exitCodeFor(failure("usage", "x"))).toBe(2);
    expect(exitCodeFor(failure("internal", "x"))).toBe(3);
  });

  test("omits recoveryAction when absent", () => {
    expect(failure("usage", "x")).toEqual({
      ok: false,
      error: { code: "usage", message: "x", recoverable: true },
    });
  });
});

describe("resolveDataDir", () => {
  test("--data wins over HUNTLINE_HOME and the upward search", () => {
    const flagDir = path.join(workDir, "flag");
    const homeDir = path.join(workDir, "home");
    mkdirSync(flagDir);
    mkdirSync(homeDir);
    writeFileSync(path.join(workDir, "huntline.json"), "{}");
    const result = resolveDataDir(
      ["doctor", "--data", flagDir],
      { HUNTLINE_HOME: homeDir },
      workDir,
    );
    expect(result).toEqual({ ok: true, value: { path: flagDir } });
  });

  test("HUNTLINE_HOME wins over the upward search", () => {
    const homeDir = path.join(workDir, "home");
    mkdirSync(homeDir);
    writeFileSync(path.join(workDir, "huntline.json"), "{}");
    const result = resolveDataDir([], { HUNTLINE_HOME: homeDir }, workDir);
    expect(result).toEqual({ ok: true, value: { path: homeDir } });
  });

  test("finds the nearest huntline.json upward", () => {
    const nested = path.join(workDir, "a", "b");
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(workDir, "a", "huntline.json"), "{}");
    const result = resolveDataDir([], {}, nested);
    expect(result).toEqual({ ok: true, value: { path: path.join(workDir, "a") } });
  });

  test("reports data-dir-not-found and usage errors", () => {
    const missing = resolveDataDir(["--data", path.join(workDir, "nope")], {}, workDir);
    expect(missing.ok ? "" : missing.error.code).toBe("data-dir-not-found");
    const noValue = resolveDataDir(["--data"], {}, workDir);
    expect(noValue.ok ? "" : noValue.error.code).toBe("usage");
    const none = resolveDataDir([], {}, workDir);
    expect(none.ok ? "" : none.error.code).toBe("data-dir-not-found");
  });
});

describe("loadProfile", () => {
  test("has three tiers: missing, malformed, ok", () => {
    const dir = { path: workDir };
    const missing = loadProfile(dir);
    expect(missing.ok ? "" : missing.error.code).toBe("profile-missing");

    writeFileSync(path.join(workDir, "profile.yaml"), "regions: [unterminated\n");
    const broken = loadProfile(dir);
    expect(broken.ok ? "" : broken.error.code).toBe("profile-malformed");

    writeFileSync(path.join(workDir, "profile.yaml"), JSON.stringify(validProfile));
    expect(loadProfile(dir).ok).toBe(true);
  });
});

describe("validateProfile", () => {
  test("accepts a valid profile", () => {
    expect(validateProfile(validProfile).ok).toBe(true);
  });

  test("names the field for an unknown contract type", () => {
    const result = validateProfile({ ...validProfile, contractTypes: ["full-time", "gig"] });
    expect(result.ok ? "" : result.error.message).toContain("contractTypes[1]");
  });

  test("rejects unknown fields, bad enums and bad numbers by name", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ ...validProfile, extra: 1 }, "extra"],
      [{ ...validProfile, remote: "sometimes" }, "remote"],
      [{ ...validProfile, outreachDailyCap: -1 }, "outreachDailyCap"],
      [{ ...validProfile, salaryFloor: { amount: 1, currency: "usd" } }, "salaryFloor.currency"],
      [{ ...validProfile, tracker: { kind: "jira" } }, "tracker.kind"],
      [{ ...validProfile, stack: { include: [], exclude: [3] } }, "stack.exclude[0]"],
    ];
    for (const [input, field] of cases) {
      const result = validateProfile(input);
      expect(result.ok ? "" : result.error.message).toContain(field);
    }
  });

  test("rejects a non-mapping document", () => {
    expect(validateProfile("nope").ok).toBe(false);
    expect(validateProfile(null).ok).toBe(false);
  });

  test("the shipped schema lists the same contract types", () => {
    const schema: unknown = JSON.parse(
      readFileSync(path.join(import.meta.dir, "../../schema/profile.schema.json"), "utf8"),
    );
    expect(JSON.stringify(schema)).toContain(JSON.stringify([...CONTRACT_TYPES]));
  });
});

describe("fs", () => {
  test("writeAtomic writes through a rename and leaves no temporary file", () => {
    const target = path.join(workDir, "nested", "file.txt");
    writeAtomic(target, "one");
    writeAtomic(target, "two");
    expect(readFileSync(target, "utf8")).toBe("two");
    expect(
      Bun.spawnSync(["ls", path.dirname(target)])
        .stdout.toString()
        .trim(),
    ).toBe("file.txt");
  });

  test("withLock serializes concurrent critical sections", async () => {
    const trace: string[] = [];
    const section = (name: string) =>
      withLock(workDir, async () => {
        trace.push(`${name}:start`);
        await Bun.sleep(30);
        trace.push(`${name}:end`);
      });
    await Promise.all([section("a"), section("b"), section("c")]);
    for (let index = 0; index < trace.length; index += 2) {
      const started = trace[index] ?? "";
      expect(trace[index + 1]).toBe(started.replace(":start", ":end"));
    }
  });

  test("withLock releases the lock when the callback throws", async () => {
    const lockFailure = await withLock(workDir, () => Promise.reject(new Error("boom"))).catch(
      (error: unknown) => error,
    );
    expect(lockFailure).toBeInstanceOf(Error);
    expect(String(lockFailure)).toContain("boom");
    expect(await withLock(workDir, () => Promise.resolve("again"))).toBe("again");
  });

  test("withLock reclaims a lock whose holder process is dead", async () => {
    const lockPath = path.join(workDir, ".huntline.lock");
    mkdirSync(lockPath);
    writeFileSync(
      path.join(lockPath, "holder.json"),
      JSON.stringify({ pid: 2_147_483_646, acquiredAt: Date.now() }),
    );
    expect(await withLock(workDir, () => Promise.resolve("reclaimed"))).toBe("reclaimed");
  });

  test("concurrent withLock callers reclaiming one dead lock never overlap", async () => {
    const lockPath = path.join(workDir, ".huntline.lock");
    mkdirSync(lockPath);
    writeFileSync(
      path.join(lockPath, "holder.json"),
      JSON.stringify({ pid: 2_147_483_646, acquiredAt: Date.now() }),
    );
    let active = 0;
    let maxActive = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        withLock(workDir, async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await Bun.sleep(15);
          active -= 1;
        }),
      ),
    );
    expect(maxActive).toBe(1);
  });
});

describe("approval", () => {
  test("approvalHash is stable and content-sensitive", () => {
    expect(approvalHash("a")).toBe(approvalHash("a"));
    expect(approvalHash("a")).not.toBe(approvalHash("b"));
    expect(approvalHash("a")).toMatch(/^[0-9a-f]{64}$/);
  });

  test("IdempotencyMap records, looks up and refuses conflicts", () => {
    const map = new IdempotencyMap(path.join(workDir, "map.json"));
    expect(map.lookup("lead-1")).toBeNull();
    map.record("lead-1", "issue-9");
    map.record("lead-1", "issue-9");
    expect(map.lookup("lead-1")).toBe("issue-9");
    expect(() => map.record("lead-1", "issue-10")).toThrow("refusing");
  });

  test("IdempotencyMap surfaces an unreadable file", () => {
    const filePath = path.join(workDir, "map.json");
    writeFileSync(filePath, "{nope");
    expect(() => new IdempotencyMap(filePath).lookup("k")).toThrow("unreadable");
  });
});

describe("commands", () => {
  test("resolves one- and two-word paths", () => {
    expect(resolveCommand(["inbox", "eval", "f.json"])).toEqual({
      path: "inbox eval",
      file: "src/inbox-eval/command.ts",
      rest: ["f.json"],
    });
    expect(resolveCommand(["inbox", "propose"])?.file).toBe("src/inbox/command.ts");
    expect(resolveCommand(["cv", "build", "k"])?.rest).toEqual(["build", "k"]);
    expect(resolveCommand(["nope"])).toBeNull();
    expect(resolveCommand([])).toBeNull();
  });

  test("every mapped module file exists", () => {
    for (const file of new Set(Object.values(COMMANDS))) {
      expect(Bun.file(path.join(import.meta.dir, "../..", file)).size).toBeGreaterThan(0);
    }
  });
});
