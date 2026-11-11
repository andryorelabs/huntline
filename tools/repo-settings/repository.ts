import { readFileSync } from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.join(import.meta.dir, "..", "..");

/** The outcome of one `gh` call. */
export interface GhOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs `gh <args>` in `cwd`; injected so tests never touch the network. */
export type GhRunner = (args: string[], cwd: string) => GhOutcome;

/** Runs `gh` for real. */
export const spawnGh: GhRunner = (args, cwd) => {
  const result = Bun.spawnSync(["gh", ...args], { stdout: "pipe", stderr: "pipe", cwd });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

/**
 * Resolves `owner/name` through `gh repo view`, pinned to this checkout so the
 * answer never depends on the caller's working directory.
 */
export function resolveRepository(runGh: GhRunner = spawnGh): string {
  const result = runGh(
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    REPO_ROOT,
  );
  const name = result.stdout.trim();
  if (result.exitCode !== 0 || name === "") {
    throw new Error(`gh repo view failed: ${result.stderr.trim() || "no output"}`);
  }
  return name;
}

/** Extracts `owner/name` from a GitHub repository URL, if it is one. */
export function repositoryFromUrl(url: string): string | undefined {
  const match = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url);
  return match?.[1];
}

/** Reads `owner/name` from the `repository` field of `package.json`. */
export function readPackageRepository(): string {
  const manifest: unknown = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const field =
    typeof manifest === "object" && manifest !== null && "repository" in manifest
      ? manifest.repository
      : undefined;
  const url =
    typeof field === "string"
      ? field
      : typeof field === "object" && field !== null && "url" in field
        ? field.url
        : undefined;
  const repository = typeof url === "string" ? repositoryFromUrl(url) : undefined;
  if (repository === undefined) {
    throw new Error("package.json has no GitHub repository URL");
  }
  return repository;
}

/** Throws unless `resolved` is the repository `package.json` names. */
export function assertExpectedRepository(resolved: string, expected: string): void {
  if (resolved.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`refusing to apply: resolved ${resolved} but package.json names ${expected}`);
  }
}
