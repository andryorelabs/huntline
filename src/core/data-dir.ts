import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PRODUCT_NAME, readSetting } from "./env.ts";
import { errorMessage, isObject } from "./narrow.ts";
import { validateProfileWithWarnings } from "./profile.ts";
import type { DataDir, Profile, Result } from "./types.ts";

const SUPPORTED_DATA_DIR_VERSION = 1;

/** The data dir marker file, written by `jobship init`. */
export const CONFIG_FILE = `${PRODUCT_NAME}.json`;

function hasConfigFile(dir: string): boolean {
  return existsSync(path.join(dir, CONFIG_FILE));
}
const PROFILE_FILE = "profile.yaml";

function readFlagValue(argv: readonly string[], flag: string): Result<string | undefined> {
  const index = argv.indexOf(flag);
  if (index === -1) return { ok: true, value: undefined };
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    return { ok: false, error: { code: "usage", message: `${flag} needs a directory` } };
  }
  return { ok: true, value };
}

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function checkVersion(dir: DataDir): Result<DataDir> {
  if (!hasConfigFile(dir.path)) return { ok: true, value: dir };
  const file = path.join(dir.path, CONFIG_FILE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "data-dir-malformed",
        message: `${CONFIG_FILE} in ${dir.path} is not valid JSON: ${errorMessage(error)}`,
      },
    };
  }
  const version = isObject(parsed) ? parsed["version"] : undefined;
  if (version === undefined) return { ok: true, value: dir };
  if (typeof version !== "number" || !Number.isFinite(version)) {
    return {
      ok: false,
      error: {
        code: "data-dir-malformed",
        message: `${CONFIG_FILE} in ${dir.path} has a non-numeric version`,
      },
    };
  }
  if (version > SUPPORTED_DATA_DIR_VERSION) {
    return {
      ok: false,
      error: {
        code: "data-dir-unsupported",
        message: `${CONFIG_FILE} in ${dir.path} is version ${version} but this jobship supports up to ${SUPPORTED_DATA_DIR_VERSION}; upgrade jobship`,
      },
    };
  }
  return { ok: true, value: dir };
}

function explicitDir(source: string, value: string, cwd: string): Result<DataDir> {
  const resolved = path.resolve(cwd, value);
  if (!isDirectory(resolved)) {
    return {
      ok: false,
      error: {
        code: "data-dir-not-found",
        message: `${source} points to ${resolved}, which is not a directory`,
      },
    };
  }
  return checkVersion({ path: resolved });
}

function findUpward(cwd: string): string | null {
  let current = path.resolve(cwd);
  for (;;) {
    if (hasConfigFile(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function resolveDataDir(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
): Result<DataDir> {
  const flag = readFlagValue(argv, "--data");
  if (!flag.ok) return flag;
  if (flag.value !== undefined) return explicitDir("--data", flag.value, cwd);
  const home = readSetting(env, "HOME");
  if (home !== undefined) return explicitDir(home.name, home.value, cwd);
  const found = findUpward(cwd);
  if (found === null) {
    return {
      ok: false,
      error: {
        code: "data-dir-not-found",
        message: `no --data, no JOBSHIP_HOME and no ${CONFIG_FILE} found upward from ${cwd}`,
      },
    };
  }
  return checkVersion({ path: found });
}

export type LoadedProfile = { readonly profile: Profile; readonly warnings: string[] };

export function loadProfile(dir: DataDir): Result<Profile> {
  const loaded = loadProfileWithWarnings(dir);
  return loaded.ok ? { ok: true, value: loaded.value.profile } : loaded;
}

export function loadProfileWithWarnings(dir: DataDir): Result<LoadedProfile> {
  const profilePath = path.join(dir.path, PROFILE_FILE);
  if (!existsSync(profilePath)) {
    return {
      ok: false,
      error: { code: "profile-missing", message: `no ${PROFILE_FILE} in ${dir.path}` },
    };
  }
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(readFileSync(profilePath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "profile-malformed",
        message: `${PROFILE_FILE} is not valid YAML: ${errorMessage(error)}`,
      },
    };
  }
  return validateProfileWithWarnings(parsed);
}
