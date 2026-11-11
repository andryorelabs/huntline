/**
 * Invariants every GitHub Actions workflow in this repository must hold. Each rule is a pure
 * function over a parsed workflow (or its raw text) that returns the offenders, so the same
 * rule runs against the real workflows and against synthetic ones that break it.
 */

interface WorkflowStep {
  readonly name?: string;
  readonly id?: string;
  readonly if?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly with?: Record<string, unknown>;
  readonly env?: Record<string, unknown>;
}

export interface WorkflowJob {
  readonly name?: string;
  readonly "runs-on"?: unknown;
  readonly uses?: string;
  readonly "timeout-minutes"?: unknown;
  readonly needs?: string | readonly string[];
  readonly if?: string;
  readonly steps?: readonly WorkflowStep[];
  readonly permissions?: unknown;
}

export interface Workflow {
  readonly on?: unknown;
  readonly permissions?: unknown;
  readonly concurrency?: unknown;
  readonly jobs: Record<string, WorkflowJob>;
}

/** The only `runs-on` value a Linux job may use: Blacksmith when configured, GitHub-hosted for forks. */
export const ROUTED_RUNS_ON =
  "${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}";

/** Tools that workflows and hooks must reach through a `package.json` script, never by name. */
const SCRIPT_ONLY_TOOLS = ["oxlint", "oxfmt", "tsc", "knip", "commitlint"] as const;

const FULL_SHA = /^[0-9a-f]{40}$/;
const USES_LINE = /^\s*-?\s*uses:\s*(\S+?)(?:\s+#\s*(.*))?$/;
const DIRECT_TOOL_CALL = new RegExp(
  `(?<![\\w-])(?<!\\bbun run )(${SCRIPT_ONLY_TOOLS.join("|")})(?![\\w.-])`,
  "g",
);

/** Whether `value` is a parsed workflow document with a `jobs` mapping. */
function isWorkflow(value: unknown): value is Workflow {
  return (
    typeof value === "object" &&
    value !== null &&
    "jobs" in value &&
    typeof value.jobs === "object" &&
    value.jobs !== null
  );
}

/** Parses one workflow file, failing when it has no `jobs` mapping. */
export function parseWorkflow(raw: string): Workflow {
  const parsed: unknown = Bun.YAML.parse(raw);
  if (!isWorkflow(parsed)) {
    throw new Error("workflow has no jobs mapping");
  }
  return parsed;
}

/** Lists the event names under a workflow's `on:`, whether it is a string, a list or a mapping. */
export function triggerNames(workflow: Workflow): string[] {
  const triggers = workflow.on;
  if (typeof triggers === "string") {
    return [triggers];
  }
  if (Array.isArray(triggers)) {
    return triggers.map(String);
  }
  return typeof triggers === "object" && triggers !== null ? Object.keys(triggers) : [];
}

/** Normalizes a job's `needs` to a sorted list of job ids. */
export function neededJobs(job: WorkflowJob | undefined): string[] {
  const needs = job?.needs;
  if (needs === undefined) {
    return [];
  }
  return (typeof needs === "string" ? [needs] : [...needs]).toSorted();
}

/** Ids of the jobs that run steps but set no numeric `timeout-minutes`. */
export function jobsWithoutTimeout(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs)
    .filter(([, job]) => job.uses === undefined && typeof job["timeout-minutes"] !== "number")
    .map(([id]) => id);
}

/** External `uses:` references not pinned to a full commit SHA followed by a `# v…` comment. */
export function unpinnedActions(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => USES_LINE.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({ reference: match[1] ?? "", comment: match[2] ?? "" }))
    .filter(({ reference }) => !reference.startsWith("./"))
    .filter(
      ({ reference, comment }) =>
        !FULL_SHA.test(reference.split("@")[1] ?? "") || !/^v\d/.test(comment),
    )
    .map(({ reference }) => reference);
}

/** Whether top-level `permissions` is exactly `{}` or `contents: read`. */
export function isMinimalPermissions(permissions: unknown): boolean {
  if (typeof permissions !== "object" || permissions === null) {
    return false;
  }
  return Object.entries(permissions).every(
    ([scope, level]) => scope === "contents" && level === "read",
  );
}

/** Whether a pull-request-triggered workflow lacks a concurrency group. */
export function lacksPullRequestConcurrency(workflow: Workflow): boolean {
  if (!triggerNames(workflow).includes("pull_request")) {
    return false;
  }
  const concurrency = workflow.concurrency;
  if (typeof concurrency === "string") {
    return concurrency === "";
  }
  return !(
    typeof concurrency === "object" &&
    concurrency !== null &&
    "group" in concurrency &&
    typeof concurrency.group === "string" &&
    concurrency.group !== ""
  );
}

/** Ids of the jobs whose `actions/checkout` step leaves the token in the git config. */
export function jobsPersistingCredentials(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs)
    .filter(([, job]) =>
      (job.steps ?? []).some(
        (step) =>
          step.uses?.startsWith("actions/checkout@") === true &&
          step.with?.["persist-credentials"] !== false,
      ),
    )
    .map(([id]) => id);
}

/** `job: tool` for every `run:` step that names a script-only tool instead of a script. */
export function directToolCalls(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs).flatMap(([id, job]) =>
    (job.steps ?? [])
      .flatMap((step) => Array.from((step.run ?? "").matchAll(DIRECT_TOOL_CALL)))
      .map((match) => `${id}: ${match[1] ?? ""}`),
  );
}

/** Ids of the jobs with a `run:` step that interpolates a `${{ }}` expression into the shell. */
export function jobsInterpolatingIntoShell(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs)
    .filter(([, job]) => (job.steps ?? []).some((step) => step.run?.includes("${{") === true))
    .map(([id]) => id);
}

/**
 * Ids of the jobs on the wrong runner: every job uses {@link ROUTED_RUNS_ON}, except macOS jobs
 * and the `githubHostedOnly` ids, which must name `ubuntu-latest` literally.
 */
export function misroutedJobs(workflow: Workflow, githubHostedOnly: readonly string[]): string[] {
  return Object.entries(workflow.jobs)
    .filter(([id, job]) => {
      const runner = job["runs-on"];
      if (githubHostedOnly.includes(id)) {
        return runner !== "ubuntu-latest";
      }
      return runner !== ROUTED_RUNS_ON && runner !== "macos-latest";
    })
    .map(([id]) => id);
}
