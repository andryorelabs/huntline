import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { errorMessage } from "./narrow.ts";
import { validateProfile } from "./profile.ts";
import type { DataDir, Profile, Result } from "./types.ts";

const CONFIG_FILE = "huntline.json";
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
  return { ok: true, value: { path: resolved } };
}

function findUpward(cwd: string): string | null {
  let current = path.resolve(cwd);
  for (;;) {
    if (existsSync(path.join(current, CONFIG_FILE))) return current;
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
  const home = env["HUNTLINE_HOME"];
  if (home !== undefined && home !== "") return explicitDir("HUNTLINE_HOME", home, cwd);
  const found = findUpward(cwd);
  if (found === null) {
    return {
      ok: false,
      error: {
        code: "data-dir-not-found",
        message: `no --data, no HUNTLINE_HOME and no ${CONFIG_FILE} found upward from ${cwd}`,
      },
    };
  }
  return { ok: true, value: { path: found } };
}

export function loadProfile(dir: DataDir): Result<Profile> {
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
  return validateProfile(parsed);
}
