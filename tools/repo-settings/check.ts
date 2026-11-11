import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { compareSettings, formatDifference, isJsonValue, isRepositorySettings } from "./compare.ts";
import type { JsonValue, RepoSettings } from "./compare.ts";
import { readLiveSettings } from "./live.ts";
import type { GhApi } from "./live.ts";

const REPO_ROOT = path.join(import.meta.dir, "..", "..");
const RULESETS_DIRECTORY = path.join(REPO_ROOT, ".github", "rulesets");
const SETTINGS_FILE = path.join(REPO_ROOT, ".github", "repo-settings.json");

/** Reads and parses a JSON file. */
function readJsonFile(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Reads the settings kept as code: `repo-settings.json` and every ruleset file. */
export function readExpectedSettings(): RepoSettings {
  const rulesets: Record<string, JsonValue> = {};
  for (const file of readdirSync(RULESETS_DIRECTORY).filter((name) => name.endsWith(".json"))) {
    const ruleset = readJsonFile(path.join(RULESETS_DIRECTORY, file));
    const name = isJsonValue(ruleset) ? rulesetName(ruleset) : undefined;
    if (!isJsonValue(ruleset) || name === undefined) {
      throw new Error(`${file} is not a named ruleset`);
    }
    rulesets[name] = ruleset;
  }
  const repository = readJsonFile(SETTINGS_FILE);
  if (!isRepositorySettings(repository)) {
    throw new Error(".github/repo-settings.json is missing a setting or has the wrong type");
  }
  return { repository, rulesets };
}

/** The `name` of a parsed ruleset, if it has one. */
function rulesetName(ruleset: JsonValue): string | undefined {
  if (typeof ruleset !== "object" || ruleset === null || Array.isArray(ruleset)) {
    return undefined;
  }
  const name = ruleset["name"];
  return typeof name === "string" ? name : undefined;
}

/** Runs `gh api <endpoint>` and captures its output. */
const runGhApi: GhApi = (endpoint) => {
  const result = Bun.spawnSync(["gh", "api", endpoint], { stdout: "pipe", stderr: "pipe" });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

/** Resolves `owner/name` of the current repository through `gh`. */
function resolveRepository(): string {
  const result = Bun.spawnSync(
    ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { stdout: "pipe", stderr: "pipe", cwd: REPO_ROOT },
  );
  const name = result.stdout.toString().trim();
  if (result.exitCode !== 0 || name === "") {
    throw new Error(`gh repo view failed: ${result.stderr.toString().trim() || "no output"}`);
  }
  return name;
}

/** Diffs live settings against the files; exit 0 for no drift, 1 for drift or unreadable. */
function main(): number {
  try {
    const live = readLiveSettings(runGhApi, resolveRepository());
    const differences = compareSettings(readExpectedSettings(), live);
    if (differences.length === 0) {
      console.log("repo settings match the files");
      return 0;
    }
    console.error(`${differences.length} difference(s) between the files and live settings:`);
    for (const difference of differences) {
      console.error(`  ${formatDifference(difference)}`);
    }
    return 1;
  } catch (error) {
    console.error(
      `repo settings unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main());
}
