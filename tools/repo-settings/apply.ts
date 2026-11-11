import type { JsonValue, RepoSettings } from "./compare.ts";
import { readExpectedSettings } from "./check.ts";
import {
  assertExpectedRepository,
  readPackageRepository,
  resolveRepository,
} from "./repository.ts";

export type HttpMethod = "PATCH" | "PUT" | "POST" | "DELETE";

/** One `gh api` call that applies part of the settings. */
export interface ApiCall {
  method: HttpMethod;
  endpoint: string;
  body?: JsonValue;
}

/** A ruleset that exists live, as the ruleset list returns it. */
export interface LiveRulesetRef {
  id: number;
  name: string;
}

/** The repository settings that `PATCH /repos/{o}/{r}` accepts directly. */
function repositoryPatchBody(settings: RepoSettings["repository"]): JsonValue {
  return {
    homepage: settings.homepage,
    allow_squash_merge: settings.allow_squash_merge,
    allow_merge_commit: settings.allow_merge_commit,
    allow_rebase_merge: settings.allow_rebase_merge,
    squash_merge_commit_title: settings.squash_merge_commit_title,
    squash_merge_commit_message: settings.squash_merge_commit_message,
    delete_branch_on_merge: settings.delete_branch_on_merge,
    allow_auto_merge: settings.allow_auto_merge,
    allow_update_branch: settings.allow_update_branch,
    has_wiki: settings.has_wiki,
    has_projects: settings.has_projects,
    has_discussions: settings.has_discussions,
    security_and_analysis: {
      secret_scanning: { status: settings.secret_scanning },
      secret_scanning_push_protection: { status: settings.secret_scanning_push_protection },
      dependabot_security_updates: { status: settings.dependabot_security_updates },
    },
  };
}

/**
 * Plans the calls that make live settings match the files. Dependabot alerts
 * come first because Dependabot security updates, set by the repository PATCH,
 * require them. A ruleset is created when no live ruleset has its name and
 * updated in place when one does.
 */
export function planApply(
  repository: string,
  expected: RepoSettings,
  liveRulesets: LiveRulesetRef[],
): ApiCall[] {
  const base = `repos/${repository}`;
  const settings = expected.repository;
  const calls: ApiCall[] = [
    {
      method: settings.dependabot_alerts ? "PUT" : "DELETE",
      endpoint: `${base}/vulnerability-alerts`,
    },
    {
      method: settings.private_vulnerability_reporting ? "PUT" : "DELETE",
      endpoint: `${base}/private-vulnerability-reporting`,
    },
    { method: "PUT", endpoint: `${base}/topics`, body: { names: settings.topics } },
    { method: "PATCH", endpoint: base, body: repositoryPatchBody(settings) },
  ];
  for (const [name, ruleset] of Object.entries(expected.rulesets)) {
    const live = liveRulesets.find((candidate) => candidate.name === name);
    calls.push(
      live === undefined
        ? { method: "POST", endpoint: `${base}/rulesets`, body: ruleset }
        : { method: "PUT", endpoint: `${base}/rulesets/${live.id}`, body: ruleset },
    );
  }
  return calls;
}

/** Renders a call as one line for the terminal. */
export function formatCall(call: ApiCall): string {
  const body = call.body === undefined ? "" : ` ${JSON.stringify(call.body)}`;
  return `${call.method} ${call.endpoint}${body}`;
}

/** Whether `value` is a ruleset list entry. */
function isLiveRulesetRef(value: unknown): value is LiveRulesetRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

/** Runs `gh` and returns its result. */
function runGh(args: string[], input?: string): { ok: boolean; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["gh", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    ...(input === undefined ? {} : { stdin: Buffer.from(input) }),
  });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

/** Reads the live ruleset list; a read, never a write. */
function readLiveRulesets(repository: string): LiveRulesetRef[] {
  const endpoint = `repos/${repository}/rulesets`;
  const result = runGh(["api", endpoint]);
  if (!result.ok) {
    throw new Error(`gh api ${endpoint} failed: ${result.stderr.trim() || "no output"}`);
  }
  const parsed: unknown = JSON.parse(result.stdout);
  if (!Array.isArray(parsed) || !parsed.every(isLiveRulesetRef)) {
    throw new Error(`gh api ${endpoint} did not return a ruleset list`);
  }
  return parsed;
}

/** Executes one call with `gh api`, sending the body on stdin. */
function executeCall(call: ApiCall): void {
  const args = ["api", "--method", call.method, call.endpoint];
  const input = call.body === undefined ? undefined : JSON.stringify(call.body);
  const result = runGh(input === undefined ? args : [...args, "--input", "-"], input);
  if (!result.ok) {
    throw new Error(`${call.method} ${call.endpoint} failed: ${result.stderr.trim()}`);
  }
}

/** Plans and, unless `--dry-run`, applies the settings; exit 0 on success, 1 on any failure. */
function main(argv: string[]): number {
  const dryRun = argv.includes("--dry-run");
  try {
    const repository = resolveRepository();
    assertExpectedRepository(repository, readPackageRepository());
    const calls = planApply(repository, readExpectedSettings(), readLiveRulesets(repository));
    for (const call of calls) {
      console.log(formatCall(call));
      if (!dryRun) {
        executeCall(call);
      }
    }
    return 0;
  } catch (error) {
    console.error(`apply failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
