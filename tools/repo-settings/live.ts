import { isJsonValue } from "./compare.ts";
import type { FeatureStatus, JsonValue, RepoSettings, RepositorySettings } from "./compare.ts";

/** The outcome of one `gh api` call. */
export interface GhResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Runs `gh api <endpoint>`; injected so tests never touch the network. */
export type GhApi = (endpoint: string) => GhResult;

/** Whether `value` is a JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses the stdout of a call, failing with the endpoint named. */
function parseJson(endpoint: string, result: GhResult): unknown {
  if (!result.ok) {
    throw new Error(`gh api ${endpoint} failed: ${result.stderr.trim() || "no output"}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`gh api ${endpoint} did not return JSON`);
  }
}

/** Calls `endpoint` and returns its JSON object. */
function readObject(callGh: GhApi, endpoint: string): Record<string, unknown> {
  const parsed = parseJson(endpoint, callGh(endpoint));
  if (!isRecord(parsed)) {
    throw new Error(`gh api ${endpoint} did not return an object`);
  }
  return parsed;
}

/** Reads a boolean field, treating a missing field as false. */
function flag(source: Record<string, unknown>, key: string): boolean {
  return source[key] === true;
}

/** Reads a string field, treating a missing field as empty. */
function text(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

/** Reads `security_and_analysis.<feature>.status`, treating a missing feature as disabled. */
function featureStatus(repo: Record<string, unknown>, feature: string): FeatureStatus {
  const analysis = repo["security_and_analysis"];
  const entry = isRecord(analysis) ? analysis[feature] : undefined;
  return isRecord(entry) && entry["status"] === "enabled" ? "enabled" : "disabled";
}

/** Reads the topic list, treating a missing list as empty. */
function topicsOf(repo: Record<string, unknown>): string[] {
  const topics = repo["topics"];
  return Array.isArray(topics)
    ? topics.filter((topic): topic is string => typeof topic === "string")
    : [];
}

/**
 * Whether Dependabot alerts are on. The endpoint answers 204 when enabled and
 * 404 when not; any other failure is unreadable, not "off".
 */
function readDependabotAlerts(callGh: GhApi, base: string): boolean {
  const result = callGh(`${base}/vulnerability-alerts`);
  if (result.ok) {
    return true;
  }
  if (/\b404\b|Not Found/i.test(result.stderr)) {
    return false;
  }
  throw new Error(`gh api ${base}/vulnerability-alerts failed: ${result.stderr.trim()}`);
}

/** Maps the repository payload and the security endpoints to `RepositorySettings`. */
function readRepositorySettings(callGh: GhApi, base: string): RepositorySettings {
  const repo = readObject(callGh, base);
  const reporting = readObject(callGh, `${base}/private-vulnerability-reporting`);
  return {
    homepage: text(repo, "homepage"),
    topics: topicsOf(repo),
    allow_squash_merge: flag(repo, "allow_squash_merge"),
    allow_merge_commit: flag(repo, "allow_merge_commit"),
    allow_rebase_merge: flag(repo, "allow_rebase_merge"),
    squash_merge_commit_title: text(repo, "squash_merge_commit_title"),
    squash_merge_commit_message: text(repo, "squash_merge_commit_message"),
    delete_branch_on_merge: flag(repo, "delete_branch_on_merge"),
    allow_auto_merge: flag(repo, "allow_auto_merge"),
    allow_update_branch: flag(repo, "allow_update_branch"),
    has_wiki: flag(repo, "has_wiki"),
    has_projects: flag(repo, "has_projects"),
    has_discussions: flag(repo, "has_discussions"),
    secret_scanning: featureStatus(repo, "secret_scanning"),
    secret_scanning_push_protection: featureStatus(repo, "secret_scanning_push_protection"),
    dependabot_alerts: readDependabotAlerts(callGh, base),
    dependabot_security_updates: featureStatus(repo, "dependabot_security_updates"),
    private_vulnerability_reporting: flag(reporting, "enabled"),
  };
}

/** Reads every ruleset of the repository, keyed by name. */
function readRulesets(callGh: GhApi, base: string): Record<string, JsonValue> {
  const listEndpoint = `${base}/rulesets`;
  const list = parseJson(listEndpoint, callGh(listEndpoint));
  if (!Array.isArray(list)) {
    throw new Error(`gh api ${listEndpoint} did not return a list`);
  }
  const rulesets: Record<string, JsonValue> = {};
  for (const entry of list as unknown[]) {
    if (!isRecord(entry) || typeof entry["id"] !== "number") {
      throw new Error(`gh api ${listEndpoint} returned a ruleset without an id`);
    }
    const detail = readObject(callGh, `${listEndpoint}/${entry["id"]}`);
    const name = detail["name"];
    if (typeof name !== "string") {
      throw new Error(`ruleset ${entry["id"]} has no name`);
    }
    if (!isJsonValue(detail)) {
      throw new Error(`ruleset ${name} is not JSON data`);
    }
    rulesets[name] = detail;
  }
  return rulesets;
}

/** Reads the live repository settings and rulesets through `callGh`. */
export function readLiveSettings(callGh: GhApi, repository: string): RepoSettings {
  const base = `repos/${repository}`;
  return {
    repository: readRepositorySettings(callGh, base),
    rulesets: readRulesets(callGh, base),
  };
}
