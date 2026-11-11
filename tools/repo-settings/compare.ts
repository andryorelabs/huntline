export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FeatureStatus = "enabled" | "disabled";

/** The repository settings kept as code in `.github/repo-settings.json`. */
export interface RepositorySettings {
  homepage: string;
  topics: string[];
  allow_squash_merge: boolean;
  allow_merge_commit: boolean;
  allow_rebase_merge: boolean;
  squash_merge_commit_title: string;
  squash_merge_commit_message: string;
  delete_branch_on_merge: boolean;
  allow_auto_merge: boolean;
  allow_update_branch: boolean;
  has_wiki: boolean;
  has_projects: boolean;
  has_discussions: boolean;
  secret_scanning: FeatureStatus;
  secret_scanning_push_protection: FeatureStatus;
  dependabot_alerts: boolean;
  dependabot_security_updates: FeatureStatus;
  private_vulnerability_reporting: boolean;
}

/** Repository settings plus every ruleset, keyed by ruleset name. */
export interface RepoSettings {
  repository: RepositorySettings;
  rulesets: Record<string, JsonValue>;
}

/** One place where live state differs from the files. */
export interface SettingDifference {
  path: string;
  expected: JsonValue | undefined;
  live: JsonValue | undefined;
}

const VOLATILE_RULESET_KEYS = new Set([
  "id",
  "node_id",
  "source",
  "source_type",
  "created_at",
  "updated_at",
  "current_user_can_bypass",
  "_links",
]);

/** Whether `value` is a plain JSON object. */
function isObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Orders two JSON values by their serialized form. */
function compareSerialized(left: JsonValue, right: JsonValue): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

/** Reads the sort key of a rule or status check, falling back to the serialized value. */
function sortKeyOf(entry: JsonValue): string {
  if (isObject(entry)) {
    const key = entry["type"] ?? entry["context"];
    if (typeof key === "string") {
      return key;
    }
  }
  return JSON.stringify(entry);
}

/**
 * Drops volatile keys and orders the lists whose order GitHub does not
 * guarantee, so that a ruleset read from disk and one read live compare equal.
 */
export function normalizeRuleset(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    const items = value.map(normalizeRuleset);
    const keyed = items.every((item) => isObject(item) && (item["type"] ?? item["context"]));
    return keyed
      ? items.toSorted((left, right) => sortKeyOf(left).localeCompare(sortKeyOf(right)))
      : items;
  }
  if (isObject(value)) {
    const result: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) {
      if (!VOLATILE_RULESET_KEYS.has(key)) {
        result[key] = normalizeRuleset(child);
      }
    }
    return sortStringArrays(result);
  }
  return value;
}

/** Sorts the ref patterns and merge-method lists inside a normalized object. */
function sortStringArrays(value: { [key: string]: JsonValue }): { [key: string]: JsonValue } {
  const result: { [key: string]: JsonValue } = {};
  for (const [key, child] of Object.entries(value)) {
    const sortable =
      Array.isArray(child) && child.every((item): item is string => typeof item === "string");
    result[key] = sortable ? child.toSorted(compareSerialized) : child;
  }
  return result;
}

/**
 * Collects differences between `expected` and `live`. Objects are compared on
 * the keys `expected` names, so a field GitHub adds later is not drift; lists
 * must match in length and order.
 */
function collectDifferences(
  expected: JsonValue | undefined,
  live: JsonValue | undefined,
  path: string,
  differences: SettingDifference[],
): void {
  if (isObject(expected)) {
    const liveObject = isObject(live) ? live : undefined;
    if (liveObject === undefined) {
      differences.push({ path, expected, live });
      return;
    }
    for (const [key, child] of Object.entries(expected)) {
      collectDifferences(child, liveObject[key], `${path}.${key}`, differences);
    }
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(live)) {
      differences.push({ path, expected, live });
      return;
    }
    const length = Math.max(expected.length, live.length);
    for (let index = 0; index < length; index += 1) {
      collectDifferences(expected[index], live[index], `${path}[${index}]`, differences);
    }
    return;
  }
  if (expected !== live) {
    differences.push({ path, expected, live });
  }
}

/** Sorts topics so that their order never counts as drift. */
function normalizeRepository(repository: RepositorySettings): JsonValue {
  const result: JsonValue = { ...repository, topics: repository.topics.toSorted() };
  return result;
}

/**
 * Compares the settings kept as code with the live settings and returns one
 * difference per drifted setting. Rulesets live on only one side are reported
 * too.
 */
export function compareSettings(expected: RepoSettings, live: RepoSettings): SettingDifference[] {
  const differences: SettingDifference[] = [];
  collectDifferences(
    normalizeRepository(expected.repository),
    normalizeRepository(live.repository),
    "repository",
    differences,
  );
  const rulesetNames = new Set([...Object.keys(expected.rulesets), ...Object.keys(live.rulesets)]);
  for (const name of [...rulesetNames].toSorted()) {
    const expectedRuleset = expected.rulesets[name];
    const liveRuleset = live.rulesets[name];
    if (expectedRuleset === undefined || liveRuleset === undefined) {
      differences.push({
        path: `rulesets.${name}`,
        expected: expectedRuleset === undefined ? undefined : normalizeRuleset(expectedRuleset),
        live: liveRuleset === undefined ? undefined : normalizeRuleset(liveRuleset),
      });
      continue;
    }
    collectDifferences(
      normalizeRuleset(expectedRuleset),
      normalizeRuleset(liveRuleset),
      `rulesets.${name}`,
      differences,
    );
  }
  return differences;
}

/** Renders one side of a difference. */
function renderValue(value: JsonValue | undefined): string {
  return value === undefined ? "(missing)" : JSON.stringify(value);
}

/** Renders a difference as one line for the terminal. */
export function formatDifference(difference: SettingDifference): string {
  return `${difference.path}: expected ${renderValue(difference.expected)}, live ${renderValue(difference.live)}`;
}

const STRING_KEYS = [
  "homepage",
  "squash_merge_commit_title",
  "squash_merge_commit_message",
] as const;

const BOOLEAN_KEYS = [
  "allow_squash_merge",
  "allow_merge_commit",
  "allow_rebase_merge",
  "delete_branch_on_merge",
  "allow_auto_merge",
  "allow_update_branch",
  "has_wiki",
  "has_projects",
  "has_discussions",
  "dependabot_alerts",
  "private_vulnerability_reporting",
] as const;

const STATUS_KEYS = [
  "secret_scanning",
  "secret_scanning_push_protection",
  "dependabot_security_updates",
] as const;

/** Whether `value` is JSON data. */
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return typeof value === "object" && Object.values(value ?? {}).every(isJsonValue);
}

/** Whether `value` carries every setting of `.github/repo-settings.json` with the right type. */
export function isRepositorySettings(value: unknown): value is RepositorySettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = new Map<string, unknown>(Object.entries(value));
  const topics = record.get("topics");
  return (
    Array.isArray(topics) &&
    topics.every((topic) => typeof topic === "string") &&
    STRING_KEYS.every((key) => typeof record.get(key) === "string") &&
    BOOLEAN_KEYS.every((key) => typeof record.get(key) === "boolean") &&
    STATUS_KEYS.every((key) => ["enabled", "disabled"].includes(String(record.get(key))))
  );
}
