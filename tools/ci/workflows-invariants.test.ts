import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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
  triggerNames,
  unpinnedActions,
  type Workflow,
  type WorkflowJob,
} from "./workflow-rules.ts";

const WORKFLOW_DIRECTORY = path.join(import.meta.dir, "..", "..", ".github", "workflows");

/**
 * Jobs that stay on a literal GitHub-hosted runner, each with the reason it is not routed.
 */
const GITHUB_HOSTED_ONLY: Record<string, Record<string, string>> = {
  "release.yml": {
    verify: "gates a release; must not depend on a third-party runner",
    release: "builds and attests the release binaries; provenance names the runner",
  },
  "scorecard.yml": {
    analysis: "Scorecard only publishes results produced on GitHub-hosted runners",
  },
};

const BINARIES = [
  "dist/jobship-linux-x64",
  "dist/jobship-linux-arm64",
  "dist/jobship-darwin-x64",
  "dist/jobship-darwin-arm64",
];

interface WorkflowFile {
  readonly fileName: string;
  readonly raw: string;
  readonly workflow: Workflow;
}

/** Parses every `.github/workflows/*.yml` file. */
function readWorkflows(): WorkflowFile[] {
  return readdirSync(WORKFLOW_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
    .toSorted()
    .map((fileName) => {
      const raw = readFileSync(path.join(WORKFLOW_DIRECTORY, fileName), "utf8");
      return { fileName, raw, workflow: parseWorkflow(raw) };
    });
}

/** Returns the named workflow file, failing when it does not exist. */
function workflowFile(files: readonly WorkflowFile[], fileName: string): WorkflowFile {
  const file = files.find((candidate) => candidate.fileName === fileName);
  if (file === undefined) {
    throw new Error(`.github/workflows/${fileName} does not exist`);
  }
  return file;
}

/** Position of the first step of a job matching `predicate`, or -1. */
function stepIndex(job: WorkflowJob | undefined, predicate: (text: string) => boolean): number {
  return (job?.steps ?? []).findIndex((step) => predicate(`${step.uses ?? ""}\n${step.run ?? ""}`));
}

const workflows = readWorkflows();

test("there is at least one workflow", () => {
  expect(workflows.length).toBeGreaterThan(0);
});

describe.each(workflows)("$fileName", ({ fileName, raw, workflow }) => {
  test("every job has timeout-minutes", () => {
    expect(jobsWithoutTimeout(workflow)).toEqual([]);
  });

  test("every action is pinned to a full SHA with a version comment", () => {
    expect(unpinnedActions(raw)).toEqual([]);
  });

  test("top-level permissions are contents: read or {}", () => {
    expect(isMinimalPermissions(workflow.permissions)).toBe(true);
  });

  test("has a concurrency group when pull requests trigger it", () => {
    expect(lacksPullRequestConcurrency(workflow)).toBe(false);
  });

  test("never uses pull_request_target", () => {
    expect(triggerNames(workflow)).not.toContain("pull_request_target");
    expect(raw).not.toContain("pull_request_target");
  });

  test("every checkout sets persist-credentials: false", () => {
    expect(jobsPersistingCredentials(workflow)).toEqual([]);
  });

  test("steps call package.json scripts, never the tools behind them", () => {
    expect(directToolCalls(workflow)).toEqual([]);
  });

  test("no run step interpolates an expression into the shell", () => {
    expect(jobsInterpolatingIntoShell(workflow)).toEqual([]);
  });

  test("Linux jobs use the BLACKSMITH_RUNNER expression", () => {
    const githubHostedOnly = Object.keys(GITHUB_HOSTED_ONLY[fileName] ?? {});
    expect(misroutedJobs(workflow, githubHostedOnly)).toEqual([]);
  });
});

describe("GitHub-hosted-only jobs", () => {
  test("every exemption names an existing job and carries a reason", () => {
    const stale = Object.entries(GITHUB_HOSTED_ONLY).flatMap(([fileName, jobs]) =>
      Object.entries(jobs)
        .filter(
          ([id, reason]) =>
            reason.trim() === "" ||
            workflows.find((file) => file.fileName === fileName)?.workflow.jobs[id] === undefined,
        )
        .map(([id]) => `${fileName}:${id}`),
    );
    expect(stale).toEqual([]);
  });
});

describe("ci.yml", () => {
  const { raw, workflow } = workflowFile(workflows, "ci.yml");
  const jobs = workflow.jobs;

  test("spares main and develop from concurrency cancellation", () => {
    expect(JSON.stringify(workflow.concurrency)).toContain("refs/heads/main");
    expect(JSON.stringify(workflow.concurrency)).toContain("refs/heads/develop");
  });

  test("runs on pushes to main and develop", () => {
    expect(raw).toContain("branches: [main, develop]");
  });

  test("runs the check and test scripts", () => {
    expect(stepIndex(jobs["check"], (text) => text.includes("bun run check"))).toBeGreaterThan(-1);
    expect(stepIndex(jobs["test"], (text) => /bun run test$/m.test(text))).toBeGreaterThan(-1);
    expect(raw).not.toMatch(/\bbun test\b/);
  });

  test("has a commitlint job over the pull request range", () => {
    const job = jobs["commitlint"];
    const checkout = (job?.steps ?? []).find((step) => step.uses?.startsWith("actions/checkout@"));
    expect(job?.if).toContain("pull_request");
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    expect(stepIndex(job, (text) => text.includes("bun run lint:commits"))).toBeGreaterThan(-1);
  });

  test("CI passed needs every other job, commitlint included, and always runs", () => {
    const gate = jobs["ci-passed"];
    const others = Object.keys(jobs)
      .filter((id) => id !== "ci-passed")
      .toSorted();
    expect(gate?.name).toBe("CI passed");
    expect(gate?.if).toContain("always()");
    expect(others).toContain("commitlint");
    expect(neededJobs(gate)).toEqual(others);
  });

  test("CI passed fails on failure or cancelled and lets a skipped job through", () => {
    expect(raw).toContain('[ "$result" = "failure" ]');
    expect(raw).toContain('[ "$result" = "cancelled" ]');
    expect(raw).not.toContain('!= "success"');
  });
});

describe("lint-pr.yml", () => {
  test("keeps the required check name", () => {
    const { workflow } = workflowFile(workflows, "lint-pr.yml");
    expect(workflow.jobs["validate-title"]?.name).toBe("Validate PR title");
  });
});

describe("release.yml", () => {
  const { raw, workflow } = workflowFile(workflows, "release.yml");
  const verify = workflow.jobs["verify"];
  const release = workflow.jobs["release"];

  test("runs on v* tags only", () => {
    expect(workflow.on).toEqual({ push: { tags: ["v*"] } });
  });

  test("verifies the tagged commit is on main, then waits for a green CI passed", () => {
    const onMain = stepIndex(verify, (text) => text.includes("merge-base --is-ancestor"));
    const greenCi = stepIndex(
      verify,
      (text) => text.includes("check-runs") && text.includes('"CI passed"'),
    );
    expect(onMain).toBeGreaterThan(-1);
    expect(greenCi).toBeGreaterThan(onMain);
    expect(verify?.permissions).toEqual({ contents: "read", checks: "read" });
    expect(raw).toContain('"${conclusion}" == "success"');
  });

  test("the release job waits for verify", () => {
    expect(neededJobs(release)).toEqual(["verify"]);
  });

  test("takes the notes from the changelog script before building anything", () => {
    const notes = stepIndex(release, (text) =>
      text.includes(
        'bun tools/release/changelog-section.ts "${GITHUB_REF_NAME}" > release-notes.md',
      ),
    );
    const build = stepIndex(release, (text) => text.includes("tools/build-binaries.ts"));
    expect(notes).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(notes);
  });

  test("publishes the changelog section as the release body", () => {
    expect(raw).toContain("--notes-file release-notes.md");
    expect(raw).not.toContain("--generate-notes");
  });

  test("attests every binary and SHA256SUMS before publishing", () => {
    const steps = release?.steps ?? [];
    const attest = steps.findIndex((step) =>
      step.uses?.startsWith("actions/attest-build-provenance@"),
    );
    const publish = stepIndex(release, (text) => text.includes("gh release create"));
    const subjects = String(steps[attest]?.with?.["subject-path"]).trim().split(/\s+/);
    expect(subjects.toSorted()).toEqual([...BINARIES, "dist/SHA256SUMS"].toSorted());
    expect(steps[attest]?.if).toBeUndefined();
    expect(publish).toBeGreaterThan(attest);
    expect(release?.permissions).toEqual({
      contents: "write",
      "id-token": "write",
      attestations: "write",
    });
  });

  test("uploads the four binaries, SHA256SUMS and the provenance bundle", () => {
    const publish = (release?.steps ?? []).find((step) => step.run?.includes("gh release create"));
    for (const asset of [...BINARIES, "dist/SHA256SUMS", "dist/jobship.intoto.jsonl"]) {
      expect(publish?.run).toContain(asset);
    }
  });
});
