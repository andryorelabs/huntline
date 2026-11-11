import { describe, expect, test } from "bun:test";
import path from "node:path";

const CHECK_SCRIPT = path.join(import.meta.dir, "check.ts");

describe("check.ts", () => {
  test("exits 1 and says unreadable when gh is missing from PATH", () => {
    const result = Bun.spawnSync([process.execPath, CHECK_SCRIPT], {
      env: { PATH: "", HOME: process.env["HOME"] ?? "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("repo settings unreadable");
  });
});
