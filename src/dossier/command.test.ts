import { describe, expect, test } from "bun:test";
import path from "node:path";
import { run } from "./command.ts";

const FIXTURE_ROOT = path.resolve(import.meta.dir, "../../fixtures/dossier/complete");

describe("dossier command", () => {
  test("check lists the sections of the complete fixture", async () => {
    const envelope = await run(["check"], {
      dataDir: { path: FIXTURE_ROOT },
      env: {},
      cwd: FIXTURE_ROOT,
    });
    expect(envelope.ok).toBe(true);
  });

  test("check without a data directory fails", async () => {
    const envelope = await run(["check"], { dataDir: null, env: {}, cwd: FIXTURE_ROOT });
    expect(envelope.ok).toBe(false);
  });

  test("an unknown subcommand is a usage error", async () => {
    const envelope = await run(["derive"], {
      dataDir: { path: FIXTURE_ROOT },
      env: {},
      cwd: FIXTURE_ROOT,
    });
    expect(envelope.ok).toBe(false);
  });
});
