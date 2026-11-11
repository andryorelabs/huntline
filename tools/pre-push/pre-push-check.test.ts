import { describe, expect, test } from "bun:test";
import { checkPush, parsePushedRefs, type PushedRef } from "./pre-push-check.ts";

const sha = "a".repeat(40);
const zero = "0".repeat(40);

const push = (branch: string, localSha = sha): PushedRef => ({
  localRef: "refs/heads/local",
  localSha,
  remoteRef: `refs/heads/${branch}`,
  remoteSha: zero,
});

describe("checkPush", () => {
  test.each(["main", "develop"])("refuses %s before typecheck", (branch) => {
    const verdict = checkPush([push(branch)]);
    expect(verdict.ok).toBe(false);
    expect(verdict.runTypecheck).toBe(false);
  });

  test.each([
    "fix/thing",
    "feat/add-guard",
    "job-110-coverage-gate",
    "renovate/bun-1.x",
    "worktree-agent-ab12",
  ])("accepts %s and runs typecheck", (branch) => {
    expect(checkPush([push(branch)])).toEqual({ ok: true, runTypecheck: true });
  });

  test.each(["thing", "Fix/Thing", "job-abc", "feature/x", "job-1"])("refuses %s", (branch) => {
    expect(checkPush([push(branch)]).ok).toBe(false);
  });

  test("skips tags and deletions", () => {
    const tag: PushedRef = { ...push("x"), remoteRef: "refs/tags/v1" };
    expect(checkPush([tag, push("main", zero)])).toEqual({ ok: true, runTypecheck: false });
  });

  test("refuses when any ref is bad", () => {
    expect(checkPush([push("fix/ok"), push("main")]).ok).toBe(false);
  });
});

describe("parsePushedRefs", () => {
  test("reads ref lines and skips blanks", () => {
    const line = `refs/heads/a ${sha} refs/heads/fix/a ${zero}`;
    expect(parsePushedRefs(`${line}\n\nbroken\n`)).toEqual([
      { localRef: "refs/heads/a", localSha: sha, remoteRef: "refs/heads/fix/a", remoteSha: zero },
    ]);
  });
});
