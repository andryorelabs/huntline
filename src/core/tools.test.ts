import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSetup } from "./setup.ts";
import {
  ensureTypst,
  installTypst,
  pdftotextInstallHint,
  resolveTypst,
  toolStatus,
  TYPST_VERSION,
  type Downloader,
  type Extractor,
  type InstallDeps,
} from "./tools.ts";

let root = "";
let env: Record<string, string | undefined> = {};

const LINUX = { os: "linux", arch: "x64" };
const ARCHIVE_BYTES = new TextEncoder().encode("synthetic archive");
const ARCHIVE_SHA = new Bun.CryptoHasher("sha256").update(ARCHIVE_BYTES).digest("hex");

const fakeExtract: Extractor = (archive, destination) => {
  const folder = path.join(destination, path.basename(archive).replace(/\.tar\.xz$/, ""));
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "typst"), "#!/bin/sh\n");
  return Promise.resolve({ ok: true, value: undefined });
};

const okDownload: Downloader = () => Promise.resolve({ ok: true, value: ARCHIVE_BYTES });

const failingDownload: Downloader = () =>
  Promise.resolve({
    ok: false,
    error: { code: "tool-download-failed", message: "offline" },
  });

const forbiddenDownload: Downloader = () => Promise.reject(new Error("must not download"));

function deps(overrides: Partial<InstallDeps> = {}): InstallDeps {
  return { platform: LINUX, download: okDownload, extract: fakeExtract, ...overrides };
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jobship-tools-"));
  env = { JOBSHIP_CACHE_DIR: path.join(root, "cache"), PATH: path.join(root, "empty-bin") };
  mkdirSync(path.join(root, "empty-bin"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("installTypst", () => {
  test("aborts on a checksum mismatch and leaves nothing cached", async () => {
    const result = await installTypst(env, deps());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("tool-checksum-mismatch");
    expect(resolveTypst(env)).toBeNull();
    const tools = path.join(root, "cache", "tools");
    expect(existsSync(tools) ? readdirSync(tools) : []).toEqual([]);
  });

  test("returns a hint on an unsupported platform", async () => {
    const result = await installTypst(env, deps({ platform: { os: "freebsd", arch: "x64" } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("tool-unsupported-platform");
      expect(result.error.message).toContain("mise use -g typst");
    }
  });

  test("surfaces a download failure with the manual hint", async () => {
    const result = await installTypst(env, deps({ download: failingDownload }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("brew install typst");
  });
});

function placeTypst(cacheRoot: string): string {
  const binary = path.join(cacheRoot, "tools", `typst-${TYPST_VERSION}`, "typst");
  mkdirSync(path.dirname(binary), { recursive: true });
  writeFileSync(binary, "");
  return binary;
}

describe("cache dir after the rename", () => {
  test("JOBSHIP_CACHE_DIR selects the cache dir", () => {
    const binary = placeTypst(path.join(root, "new-cache"));
    const custom = { ...env, JOBSHIP_CACHE_DIR: path.join(root, "new-cache") };
    expect(resolveTypst(custom)).toEqual({ path: binary, source: "cache" });
  });

  test("defaults to ~/.cache/jobship", () => {
    const binary = placeTypst(path.join(root, ".cache", "jobship"));
    expect(resolveTypst({ HOME: root, PATH: env["PATH"] })).toEqual({
      path: binary,
      source: "cache",
    });
  });
});

describe("installTypst success", () => {
  test("verifies, extracts and caches the binary atomically", async () => {
    const assets = { "linux-x64": { asset: "typst-test.tar.xz", sha256: ARCHIVE_SHA } };
    const result = await installTypst(env, deps({ assets }));
    const cached = path.join(root, "cache", "tools", `typst-${TYPST_VERSION}`, "typst");
    expect(result).toEqual({ ok: true, value: cached });
    expect(statSync(cached).mode & 0o111).not.toBe(0);
    expect(readdirSync(path.join(root, "cache", "tools"))).toEqual([`typst-${TYPST_VERSION}`]);
  });
});

describe("ensureTypst", () => {
  test("prefers typst on PATH and never downloads", async () => {
    const bin = path.join(root, "bin");
    mkdirSync(bin);
    const fake = path.join(bin, "typst");
    writeFileSync(fake, "#!/bin/sh\n", { mode: 0o755 });
    const result = await ensureTypst({ ...env, PATH: bin }, deps({ download: forbiddenDownload }));
    expect(result).toEqual({ ok: true, value: fake });
  });

  test("reuses the cached binary without downloading", async () => {
    const cached = path.join(root, "cache", "tools", `typst-${TYPST_VERSION}`, "typst");
    mkdirSync(path.dirname(cached), { recursive: true });
    writeFileSync(cached, "#!/bin/sh\n");
    const result = await ensureTypst(env, deps({ download: forbiddenDownload }));
    expect(result).toEqual({ ok: true, value: cached });
    expect(resolveTypst(env)?.source).toBe("cache");
  });
});

describe("toolStatus and setup", () => {
  test("reports missing tools with the platform install hint", () => {
    const status = toolStatus(env, LINUX);
    expect(status.typst).toMatchObject({ found: false, source: "missing", path: null });
    expect(status.pdftotext.found).toBe(false);
    expect(status.pdftotext.installHint).toBe("sudo apt install poppler-utils");
    expect(pdftotextInstallHint({ os: "darwin", arch: "arm64" })).toBe("brew install poppler");
  });

  test("setup fails with cv-tool-missing when pdftotext is absent", async () => {
    const cached = path.join(root, "cache", "tools", `typst-${TYPST_VERSION}`, "typst");
    mkdirSync(path.dirname(cached), { recursive: true });
    writeFileSync(cached, "#!/bin/sh\n");
    const envelope = await runSetup(env, deps(), LINUX);
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe("cv-tool-missing");
      expect(envelope.error.recoveryAction).toContain("sudo apt install poppler-utils");
    }
  });

  test("setup succeeds when both tools are present", async () => {
    const bin = path.join(root, "bin");
    mkdirSync(bin);
    for (const name of ["typst", "pdftotext"])
      writeFileSync(path.join(bin, name), "#!/bin/sh\n", { mode: 0o755 });
    const envelope = await runSetup({ ...env, PATH: bin }, deps(), LINUX);
    expect(envelope.ok).toBe(true);
    if (envelope.ok)
      expect(envelope.data).toMatchObject({ typst: { found: true, source: "path" } });
  });
});
