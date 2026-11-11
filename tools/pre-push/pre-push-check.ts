/**
 * One ref line from the pre-push hook's standard input.
 */
export interface PushedRef {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
}

/**
 * Outcome of checking the pushed refs.
 */
export type PushVerdict =
  | { ok: true; runTypecheck: boolean }
  | { ok: false; reason: string; runTypecheck: false };

const zeroSha = /^0+$/;
const branchPrefix = "refs/heads/";
const conventionalBranch =
  /^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ticketBranch = /^job-\d+(?:-[a-z0-9]+)+$/;
const renovateBranch = /^renovate\/.+$/;
const worktreeBranch = /^worktree-.+$/;

/**
 * Parses the hook's standard input into refs, skipping blank or malformed lines.
 */
export function parsePushedRefs(input: string): PushedRef[] {
  return input.split("\n").flatMap((line) => {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    if (
      localRef === undefined ||
      localSha === undefined ||
      remoteRef === undefined ||
      remoteSha === undefined
    ) {
      return [];
    }
    return [{ localRef, localSha, remoteRef, remoteSha }];
  });
}

/**
 * Refuses a push to `main` or to a branch outside the naming rules, before any gate runs.
 * Tag pushes and branch deletions are skipped; typecheck runs only when a branch is updated.
 */
export function checkPush(refs: PushedRef[]): PushVerdict {
  let updatesBranch = false;
  for (const ref of refs) {
    if (!ref.remoteRef.startsWith(branchPrefix) || zeroSha.test(ref.localSha)) continue;
    updatesBranch = true;
    const branch = ref.remoteRef.slice(branchPrefix.length);
    if (branch === "main") {
      return {
        ok: false,
        reason: "pushing to main is not allowed; push a feature branch and open a PR",
        runTypecheck: false,
      };
    }
    const allowed =
      conventionalBranch.test(branch) ||
      ticketBranch.test(branch) ||
      renovateBranch.test(branch) ||
      worktreeBranch.test(branch);
    if (!allowed) {
      return {
        ok: false,
        reason: `branch "${branch}" must match <type>/<slug>, job-<n>-<slug>, worktree-* or renovate/*`,
        runTypecheck: false,
      };
    }
  }
  return { ok: true, runTypecheck: updatesBranch };
}
