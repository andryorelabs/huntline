import { describe, expect, test } from "bun:test";
import {
  directToolCalls,
  isMinimalPermissions,
  jobsInterpolatingIntoShell,
  jobsPersistingCredentials,
  jobsWithoutTimeout,
  lacksPullRequestConcurrency,
  misroutedJobs,
  neededJobs,
  parseWorkflow,
  ROUTED_RUNS_ON,
  triggerNames,
  unpinnedActions,
} from "./workflow-rules.ts";

const PINNED_CHECKOUT = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";

/** Builds a one-job workflow whose job body is the given indented YAML lines. */
function workflowWithJob(jobLines: readonly string[], head: readonly string[] = []): string {
  return [
    "on:",
    "  pull_request:",
    ...head,
    "jobs:",
    "  build:",
    ...jobLines.map((line) => `    ${line}`),
    "",
  ].join("\n");
}

/** Builds a one-job workflow that runs the given shell command. */
function workflowRunning(command: string): string {
  return workflowWithJob(["runs-on: ubuntu-latest", "steps:", `  - run: ${command}`]);
}

describe("parseWorkflow", () => {
  test("rejects a document without a jobs mapping", () => {
    expect(() => parseWorkflow("name: nothing\n")).toThrow("no jobs mapping");
  });

  test("reads triggers written as a mapping, a list or a single name", () => {
    expect(triggerNames(parseWorkflow("on:\n  push:\n  pull_request:\njobs: {}\n"))).toEqual([
      "push",
      "pull_request",
    ]);
    expect(triggerNames(parseWorkflow("on: [push, pull_request]\njobs: {}\n"))).toEqual([
      "push",
      "pull_request",
    ]);
    expect(triggerNames(parseWorkflow("on: push\njobs: {}\n"))).toEqual(["push"]);
  });

  test("normalizes needs to a sorted list", () => {
    const { jobs } = parseWorkflow("jobs:\n  a:\n    needs: z\n  b:\n    needs: [y, x]\n  c: {}\n");
    expect(neededJobs(jobs["a"])).toEqual(["z"]);
    expect(neededJobs(jobs["b"])).toEqual(["x", "y"]);
    expect(neededJobs(jobs["c"])).toEqual([]);
    expect(neededJobs(undefined)).toEqual([]);
  });
});

describe("jobsWithoutTimeout", () => {
  test("flags a job that lacks timeout-minutes", () => {
    const workflow = parseWorkflow(workflowWithJob(["runs-on: ubuntu-latest", "steps: []"]));
    expect(jobsWithoutTimeout(workflow)).toEqual(["build"]);
  });

  test("accepts a numeric timeout and a reusable-workflow call", () => {
    const timed = parseWorkflow(workflowWithJob(["timeout-minutes: 5", "steps: []"]));
    const reusable = parseWorkflow(workflowWithJob(["uses: ./.github/workflows/other.yml"]));
    expect(jobsWithoutTimeout(timed)).toEqual([]);
    expect(jobsWithoutTimeout(reusable)).toEqual([]);
  });
});

describe("unpinnedActions", () => {
  test("flags an action pinned by tag", () => {
    expect(unpinnedActions("      - uses: actions/checkout@v7\n")).toEqual(["actions/checkout@v7"]);
  });

  test("flags a branch pin, a short SHA and a SHA without a version comment", () => {
    const raw = [
      "      - uses: actions/checkout@main",
      "      - uses: actions/checkout@3d3c42e # v7.0.1",
      "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # latest",
    ].join("\n");
    expect(unpinnedActions(raw)).toHaveLength(4);
  });

  test("accepts a full SHA with a version comment and a local action", () => {
    const raw = [`      - uses: ${PINNED_CHECKOUT}`, "      - uses: ./.github/actions/setup"];
    expect(unpinnedActions(raw.join("\n"))).toEqual([]);
  });
});

describe("isMinimalPermissions", () => {
  test("accepts {} and contents: read only", () => {
    expect(isMinimalPermissions({})).toBe(true);
    expect(isMinimalPermissions({ contents: "read" })).toBe(true);
  });

  test("rejects a missing block, a write scope and any extra scope", () => {
    expect(isMinimalPermissions(undefined)).toBe(false);
    expect(isMinimalPermissions("write-all")).toBe(false);
    expect(isMinimalPermissions({ contents: "write" })).toBe(false);
    expect(isMinimalPermissions({ contents: "read", issues: "read" })).toBe(false);
  });
});

describe("lacksPullRequestConcurrency", () => {
  test("flags a pull-request workflow without a concurrency group", () => {
    expect(lacksPullRequestConcurrency(parseWorkflow(workflowWithJob(["steps: []"])))).toBe(true);
    const emptyGroup = workflowWithJob(
      ["steps: []"],
      ["concurrency:", "  cancel-in-progress: true"],
    );
    expect(lacksPullRequestConcurrency(parseWorkflow(emptyGroup))).toBe(true);
  });

  test("accepts a group, as a mapping or as a string", () => {
    const mapping = workflowWithJob(
      ["steps: []"],
      ["concurrency:", "  group: ci-${{ github.ref }}"],
    );
    const short = workflowWithJob(["steps: []"], ["concurrency: ci-${{ github.ref }}"]);
    expect(lacksPullRequestConcurrency(parseWorkflow(mapping))).toBe(false);
    expect(lacksPullRequestConcurrency(parseWorkflow(short))).toBe(false);
  });

  test("ignores a workflow that pull requests do not trigger", () => {
    expect(lacksPullRequestConcurrency(parseWorkflow("on:\n  schedule: []\njobs: {}\n"))).toBe(
      false,
    );
  });
});

describe("jobsPersistingCredentials", () => {
  test("flags a checkout that does not set persist-credentials: false", () => {
    const bare = workflowWithJob(["steps:", `  - uses: ${PINNED_CHECKOUT}`]);
    const persisted = workflowWithJob([
      "steps:",
      `  - uses: ${PINNED_CHECKOUT}`,
      "    with:",
      "      persist-credentials: true",
    ]);
    expect(jobsPersistingCredentials(parseWorkflow(bare))).toEqual(["build"]);
    expect(jobsPersistingCredentials(parseWorkflow(persisted))).toEqual(["build"]);
  });

  test("accepts persist-credentials: false", () => {
    const safe = workflowWithJob([
      "steps:",
      `  - uses: ${PINNED_CHECKOUT}`,
      "    with:",
      "      persist-credentials: false",
    ]);
    expect(jobsPersistingCredentials(parseWorkflow(safe))).toEqual([]);
  });
});

describe("directToolCalls", () => {
  test.each([
    ["oxlint --type-aware", "oxlint"],
    ["bun x oxfmt --check", "oxfmt"],
    ["node_modules/.bin/tsc --noEmit", "tsc"],
    ["bunx knip", "knip"],
    ['bun x --no-install commitlint --from "$BASE" --to HEAD', "commitlint"],
  ])("flags a step that runs `%s`", (command, tool) => {
    expect(directToolCalls(parseWorkflow(workflowRunning(command)))).toEqual([`build: ${tool}`]);
  });

  test("flags a tool buried in a multi-line step", () => {
    const workflow = parseWorkflow(
      workflowWithJob(["steps:", "  - run: |", "      bun install", "      oxlint ."]),
    );
    expect(directToolCalls(workflow)).toEqual(["build: oxlint"]);
  });

  test.each([
    "bun run check",
    "bun run test",
    "bun run lint:commits",
    "bun run knip",
    "bun run typecheck -p tsconfig.json",
    "actionlint -color",
    "cat knip.jsonc commitlint.config.ts .oxlintrc.json",
  ])("accepts `%s`", (command) => {
    expect(directToolCalls(parseWorkflow(workflowRunning(command)))).toEqual([]);
  });
});

describe("jobsInterpolatingIntoShell", () => {
  test("flags an expression inside run and accepts one passed through env", () => {
    const unsafe = workflowRunning('echo "${{ github.event.pull_request.title }}"');
    const safe = workflowWithJob([
      "steps:",
      '  - run: echo "$TITLE"',
      "    env:",
      "      TITLE: ${{ github.event.pull_request.title }}",
    ]);
    expect(jobsInterpolatingIntoShell(parseWorkflow(unsafe))).toEqual(["build"]);
    expect(jobsInterpolatingIntoShell(parseWorkflow(safe))).toEqual([]);
  });
});

describe("misroutedJobs", () => {
  test("flags a Linux job on a literal runner", () => {
    const workflow = parseWorkflow(workflowWithJob(["runs-on: ubuntu-latest"]));
    expect(misroutedJobs(workflow, [])).toEqual(["build"]);
  });

  test("accepts the routed expression and macOS", () => {
    const routed = parseWorkflow(workflowWithJob([`runs-on: ${ROUTED_RUNS_ON}`]));
    const macos = parseWorkflow(workflowWithJob(["runs-on: macos-latest"]));
    expect(misroutedJobs(routed, [])).toEqual([]);
    expect(misroutedJobs(macos, [])).toEqual([]);
  });

  test("holds a GitHub-hosted-only job to the literal ubuntu-latest", () => {
    const literal = parseWorkflow(workflowWithJob(["runs-on: ubuntu-latest"]));
    const routed = parseWorkflow(workflowWithJob([`runs-on: ${ROUTED_RUNS_ON}`]));
    expect(misroutedJobs(literal, ["build"])).toEqual([]);
    expect(misroutedJobs(routed, ["build"])).toEqual(["build"]);
  });

  test("sends fork pull requests to ubuntu-latest before reading the variable", () => {
    expect(ROUTED_RUNS_ON).toMatch(
      /head\.repo\.fork && 'ubuntu-latest' \|\| vars\.BLACKSMITH_RUNNER \|\| 'ubuntu-latest'/,
    );
  });
});
