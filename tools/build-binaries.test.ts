import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isObject } from "../src/core/narrow.ts";
import {
  binaryName,
  buildBinary,
  parseArguments,
  readPluginVersion,
  TARGETS,
} from "./build-binaries.ts";

describe("build-binaries helpers", () => {
  test("binaryName drops the bun- prefix", () => {
    expect(binaryName("bun-darwin-arm64")).toBe("jobship-darwin-arm64");
  });

  test("builds cover linux and macos on x64 and arm64", () => {
    expect([...TARGETS].map(binaryName).toSorted()).toEqual([
      "jobship-darwin-arm64",
      "jobship-darwin-x64",
      "jobship-linux-arm64",
      "jobship-linux-x64",
    ]);
  });

  test("parseArguments defaults to all four targets", () => {
    expect(parseArguments([])).toEqual({ targets: [...TARGETS], outdir: "dist" });
  });

  test("parseArguments accepts one target and an outdir", () => {
    expect(parseArguments(["--target", "bun-linux-x64", "--outdir", "out"])).toEqual({
      targets: ["bun-linux-x64"],
      outdir: "out",
    });
  });

  test("parseArguments rejects unknown targets and flags", () => {
    expect(() => parseArguments(["--target", "bun-windows-x64"])).toThrow("unsupported target");
    expect(() => parseArguments(["--nope", "x"])).toThrow("unknown argument");
    expect(() => parseArguments(["--outdir"])).toThrow("needs a value");
  });

  test("readPluginVersion reads plugin.json and falls back to the dev version", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "jobship-version-"));
    try {
      expect(readPluginVersion(root)).toBe("0.0.0-dev");
      mkdirSync(path.join(root, ".claude-plugin"));
      writeFileSync(path.join(root, ".claude-plugin", "plugin.json"), "{}");
      expect(readPluginVersion(root)).toBe("0.0.0-dev");
      writeFileSync(path.join(root, ".claude-plugin", "plugin.json"), '{"version":"0.2.0"}');
      expect(readPluginVersion(root)).toBe("0.2.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe.skipIf(process.platform !== "linux" || process.arch !== "x64")(
  "compiled binary smoke",
  () => {
    let workdir = "";
    let binary = "";

    beforeAll(async () => {
      workdir = mkdtempSync(path.join(os.tmpdir(), "jobship-binary-"));
      binary = await buildBinary("bun-linux-x64", path.join(workdir, "out"), "0.2.0");
      chmodSync(binary, 0o755);
    }, 120_000);
    afterAll(() => rmSync(workdir, { recursive: true, force: true }));

    const run = (...args: string[]) =>
      Bun.spawnSync([binary, ...args], { cwd: workdir, env: { HOME: workdir, PATH: "" } });

    test("prints the embedded version", () => {
      const result = run("--version");
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.toString())).toEqual({
        ok: true,
        data: { version: "0.2.0" },
      });
    });

    test("init and doctor work from the compiled binary", () => {
      const target = path.join(workdir, "data");
      expect(run("init", "--data", target).exitCode).toBe(0);
      const doctor = run("doctor", "--data", target);
      expect(doctor.exitCode).toBe(1);
      expect(doctor.stdout.toString()).toContain("dossier-incomplete");
    });

    test("inbox eval finds its embedded fixtures in the compiled binary", () => {
      const fixtureDir = path.resolve(import.meta.dir, "..", "fixtures", "inbox");
      const predictions = ["emails-en.json", "emails-es.json"].flatMap((name) => {
        const rows: unknown = JSON.parse(readFileSync(path.join(fixtureDir, name), "utf8"));
        if (!Array.isArray(rows)) throw new Error(`fixture ${name} is not an array`);
        return rows.map((row: unknown) => {
          if (!isObject(row)) throw new Error(`fixture ${name} has a non-object row`);
          return { messageId: row["messageId"], classification: row["label"] };
        });
      });
      const file = path.join(workdir, "classifications.json");
      writeFileSync(file, JSON.stringify(predictions));
      const result = run("inbox", "eval", file);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.toString())).toMatchObject({
        ok: true,
        data: { accuracy: 1 },
      });
    });

    test("lazily loaded commands run through the compiled binary", () => {
      const result = run("sweep");
      expect(result.exitCode).not.toBe(0);
      const envelope: unknown = JSON.parse(result.stdout.toString());
      if (!isObject(envelope)) throw new Error("envelope is not an object");
      expect(envelope["ok"]).toBe(false);
      const error = envelope["error"];
      expect(isObject(error) ? error["code"] : undefined).not.toBe("not-implemented");
    });
  },
);
