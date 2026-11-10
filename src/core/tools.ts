import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { errorMessage } from "./narrow.ts";
import type { Result } from "./types.ts";

export const TYPST_VERSION = "0.15.1";

type TypstAsset = { readonly asset: string; readonly sha256: string };

const TYPST_ASSETS: Readonly<Record<string, TypstAsset>> = {
  "linux-x64": {
    asset: "typst-x86_64-unknown-linux-musl.tar.xz",
    sha256: "a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c",
  },
  "linux-arm64": {
    asset: "typst-aarch64-unknown-linux-musl.tar.xz",
    sha256: "5aa8d74a3d906e60ea12a66ac2f37f8eef1b14cbad7182a745e393a10c23dcee",
  },
  "darwin-x64": {
    asset: "typst-x86_64-apple-darwin.tar.xz",
    sha256: "7f9fdd9584866245de9a79e0add8f9236fae6f40a8a45e2c4771ccc14db4e0fa",
  },
  "darwin-arm64": {
    asset: "typst-aarch64-apple-darwin.tar.xz",
    sha256: "48f62ed034aa3a7978309579ac6ca00045e2ef0da73114e8af27cfd8e74dc05a",
  },
};

const RELEASE_BASE_URL = "https://github.com/typst/typst/releases/download";
const TYPST_MANUAL_HINT =
  "install typst yourself: mise use -g typst, cargo install typst-cli or brew install typst";

export type ToolEnv = Readonly<Record<string, string | undefined>>;
export type PlatformInfo = { readonly os: string; readonly arch: string };
export type Downloader = (url: string) => Promise<Result<Uint8Array>>;
export type Extractor = (archive: string, destination: string) => Promise<Result<void>>;
export type InstallDeps = {
  readonly platform: PlatformInfo;
  readonly download: Downloader;
  readonly extract: Extractor;
  readonly assets?: Readonly<Record<string, TypstAsset>>;
};

type ToolSource = "path" | "cache" | "missing";
export type ToolStatus = {
  readonly typst: {
    readonly found: boolean;
    readonly source: ToolSource;
    readonly path: string | null;
    readonly version: string;
  };
  readonly pdftotext: {
    readonly found: boolean;
    readonly path: string | null;
    readonly installHint: string;
  };
};

function currentPlatform(): PlatformInfo {
  return { os: process.platform, arch: process.arch };
}

function cacheRoot(env: ToolEnv): string {
  const override = env["HUNTLINE_CACHE_DIR"];
  if (override !== undefined && override !== "") return override;
  const xdg = env["XDG_CACHE_HOME"];
  if (xdg !== undefined && xdg !== "") return path.join(xdg, "huntline");
  return path.join(env["HOME"] ?? os.homedir(), ".cache", "huntline");
}

function toolsRoot(env: ToolEnv): string {
  return path.join(cacheRoot(env), "tools");
}

function cachedTypstPath(env: ToolEnv): string {
  return path.join(toolsRoot(env), `typst-${TYPST_VERSION}`, "typst");
}

function onPath(name: string, env: ToolEnv): string | null {
  return Bun.which(name, { PATH: env["PATH"] ?? "" });
}

export function resolveTypst(env: ToolEnv): { path: string; source: "path" | "cache" } | null {
  const found = onPath("typst", env);
  if (found !== null) return { path: found, source: "path" };
  const cached = cachedTypstPath(env);
  return existsSync(cached) ? { path: cached, source: "cache" } : null;
}

export function pdftotextInstallHint(platform: PlatformInfo): string {
  return platform.os === "darwin" ? "brew install poppler" : "sudo apt install poppler-utils";
}

export function toolStatus(env: ToolEnv, platform: PlatformInfo = currentPlatform()): ToolStatus {
  const typst = resolveTypst(env);
  const pdftotext = onPath("pdftotext", env);
  return {
    typst: {
      found: typst !== null,
      source: typst === null ? "missing" : typst.source,
      path: typst === null ? null : typst.path,
      version: TYPST_VERSION,
    },
    pdftotext: {
      found: pdftotext !== null,
      path: pdftotext,
      installHint: pdftotextInstallHint(platform),
    },
  };
}

function sha256Hex(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

const systemDownloader: Downloader = async (url) => {
  if (!url.startsWith("https://")) {
    return {
      ok: false,
      error: { code: "tool-download-failed", message: `refusing non-https url ${url}` },
    };
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        error: { code: "tool-download-failed", message: `${url} answered ${response.status}` },
      };
    }
    return { ok: true, value: new Uint8Array(await response.arrayBuffer()) };
  } catch (error) {
    return { ok: false, error: { code: "tool-download-failed", message: errorMessage(error) } };
  }
};

const systemExtractor: Extractor = async (archive, destination) => {
  try {
    const handle = Bun.spawn(["tar", "-xJf", archive, "-C", destination], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stderr, exitCode] = await Promise.all([
      new Response(handle.stderr).text(),
      handle.exited,
    ]);
    if (exitCode !== 0) {
      return {
        ok: false,
        error: { code: "tool-extract-failed", message: `tar exited ${exitCode}: ${stderr.trim()}` },
      };
    }
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: { code: "tool-extract-failed", message: errorMessage(error) } };
  }
};

export function systemInstallDeps(): InstallDeps {
  return { platform: currentPlatform(), download: systemDownloader, extract: systemExtractor };
}

function installFailure(code: string, message: string): Result<string> {
  return { ok: false, error: { code, message: `${message}; ${TYPST_MANUAL_HINT}` } };
}

export async function installTypst(env: ToolEnv, deps: InstallDeps): Promise<Result<string>> {
  const asset = (deps.assets ?? TYPST_ASSETS)[`${deps.platform.os}-${deps.platform.arch}`];
  if (asset === undefined) {
    return installFailure(
      "tool-unsupported-platform",
      `no typst build for ${deps.platform.os}-${deps.platform.arch}`,
    );
  }
  const downloaded = await deps.download(`${RELEASE_BASE_URL}/v${TYPST_VERSION}/${asset.asset}`);
  if (!downloaded.ok) return installFailure(downloaded.error.code, downloaded.error.message);
  if (sha256Hex(downloaded.value) !== asset.sha256) {
    return installFailure("tool-checksum-mismatch", `checksum mismatch for ${asset.asset}`);
  }
  const root = toolsRoot(env);
  mkdirSync(root, { recursive: true });
  const staging = mkdtempSync(path.join(root, ".download-"));
  try {
    const archive = path.join(staging, asset.asset);
    writeFileSync(archive, downloaded.value);
    const extracted = await deps.extract(archive, staging);
    if (!extracted.ok) return installFailure(extracted.error.code, extracted.error.message);
    const unpacked = path.join(staging, asset.asset.replace(/\.tar\.xz$/, ""), "typst");
    if (!existsSync(unpacked))
      return installFailure("tool-extract-failed", `typst binary missing in ${asset.asset}`);
    chmodSync(unpacked, 0o755);
    const target = cachedTypstPath(env);
    mkdirSync(path.dirname(target), { recursive: true });
    renameSync(unpacked, target);
    return { ok: true, value: target };
  } catch (error) {
    return installFailure("tool-install-failed", errorMessage(error));
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export async function ensureTypst(env: ToolEnv, deps: InstallDeps): Promise<Result<string>> {
  const resolved = resolveTypst(env);
  if (resolved !== null) return { ok: true, value: resolved.path };
  return installTypst(env, deps);
}
