import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BANNER_ANSI, BANNER_TEXT, writeBanner, writeBannerForArgs } from "./banner.ts";

const terminalDir = path.join(import.meta.dir, "../../docs/brand/terminal");
const cliPath = path.join(import.meta.dir, "../cli.ts");

function collector(isTTY: boolean): {
  stream: { isTTY: boolean; write(chunk: string): void };
  chunks: string[];
} {
  const chunks: string[] = [];
  return {
    chunks,
    stream: {
      isTTY,
      write(chunk: string): void {
        chunks.push(chunk);
      },
    },
  };
}

function runCliRaw(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = Bun.spawnSync([process.execPath, cliPath, ...args], {
    env: { PATH: process.env["PATH"] ?? "", HOME: "/nonexistent" },
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    code: result.exitCode,
  };
}

describe("banner constants", () => {
  test("match the brand files byte for byte", () => {
    expect(BANNER_TEXT).toBe(readFileSync(path.join(terminalDir, "banner.txt"), "utf8"));
    expect(BANNER_ANSI).toBe(readFileSync(path.join(terminalDir, "banner.ansi"), "utf8"));
  });

  test("use only 16-colour codes", () => {
    const codes = BANNER_ANSI.split("\u001b[")
      .slice(1)
      .map((part) => part.slice(0, part.indexOf("m")));
    expect(new Set(codes)).toEqual(new Set(["94", "1", "2", "0"]));
  });
});

describe("writeBanner", () => {
  test("writes nothing to a non-TTY stream", () => {
    const { stream, chunks } = collector(false);
    writeBanner(stream, {});
    expect(chunks).toEqual([]);
  });

  test("writes the colour banner to a TTY", () => {
    const { stream, chunks } = collector(true);
    writeBanner(stream, {});
    expect(chunks).toEqual([BANNER_ANSI]);
  });

  test("NO_COLOR selects the plain text", () => {
    const { stream, chunks } = collector(true);
    writeBanner(stream, { NO_COLOR: "1" });
    expect(chunks).toEqual([BANNER_TEXT]);
  });

  test("an empty NO_COLOR is ignored", () => {
    const { stream, chunks } = collector(true);
    writeBanner(stream, { NO_COLOR: "" });
    expect(chunks).toEqual([BANNER_ANSI]);
  });

  test("never throws when the stream fails", () => {
    const stream = {
      isTTY: true,
      write(): never {
        throw new Error("closed");
      },
    };
    expect(() => writeBanner(stream, {})).not.toThrow();
  });
});

const tty = () => {
  const chunks: string[] = [];
  return { isTTY: true, write: (chunk: string) => chunks.push(chunk), chunks };
};

describe("writeBannerForArgs", () => {
  for (const args of [[], ["--help"], ["help"], ["help", "extra"]]) {
    test(`${JSON.stringify(args)} writes the banner on a TTY`, () => {
      const stream = tty();
      writeBannerForArgs(args, stream, {});
      expect(stream.chunks).toEqual([BANNER_ANSI]);
    });
  }

  for (const args of [["doctor"], ["--version"], ["guard"], ["sweep", "--help"], ["--data", "x"]]) {
    test(`${JSON.stringify(args)} never writes the banner`, () => {
      const stream = tty();
      writeBannerForArgs(args, stream, {});
      expect(stream.chunks).toEqual([]);
    });
  }
});

describe("help CLI output", () => {
  for (const args of [[], ["--help"], ["help"]]) {
    test(`${JSON.stringify(args)} keeps stdout a JSON envelope and stderr empty off a TTY`, () => {
      const result = runCliRaw(args);
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      const lines = result.stdout.split("\n").filter((line) => line !== "");
      expect(lines).toHaveLength(1);
      const envelope: unknown = JSON.parse(lines[0] ?? "");
      expect(envelope).toMatchObject({ ok: true });
    });
  }

  test("no-args, --help and help share one envelope", () => {
    const outputs = [[], ["--help"], ["help"]].map((args) => runCliRaw(args).stdout);
    expect(new Set(outputs).size).toBe(1);
  });
});
