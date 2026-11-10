import { existsSync } from "node:fs";
import path from "node:path";
import answersTemplate from "../../templates/answers.json.tmpl" with { type: "text" };
import bulletsTemplate from "../../templates/bullets.yaml" with { type: "text" };
import configTemplate from "../../templates/huntline.json.tmpl" with { type: "text" };
import factsTemplate from "../../templates/facts.yaml" with { type: "text" };
import neverClaimTemplate from "../../templates/never-claim.yaml" with { type: "text" };
import profileTemplate from "../../templates/profile.yaml" with { type: "text" };
import cvTemplate from "../../templates/cv-template.typ" with { type: "text" };
import { failure, success, type Envelope } from "./envelope.ts";
import { withLock, writeAtomic } from "./fs.ts";

function templateText(content: unknown): string {
  if (typeof content !== "string") throw new TypeError("a bundled template did not load as text");
  return content;
}

const SCAFFOLD_FILES: Readonly<Record<string, string>> = {
  "huntline.json": templateText(configTemplate),
  "profile.yaml": templateText(profileTemplate),
  "facts.yaml": templateText(factsTemplate),
  "bullets.yaml": templateText(bulletsTemplate),
  "never-claim.yaml": templateText(neverClaimTemplate),
  "answers.json": templateText(answersTemplate),
  "cv/template.typ": templateText(cvTemplate),
};

export const MARKER = "TODO(huntline):";

function readDirectoryFlag(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--data");
  return index === -1 ? undefined : argv[index + 1];
}

export async function runInit(
  argv: string[],
  cwd: string,
  env: Record<string, string | undefined> = {},
): Promise<Envelope<unknown>> {
  const requested = readDirectoryFlag(argv);
  if (argv.includes("--data") && (requested === undefined || requested.startsWith("--"))) {
    return failure("usage", "--data needs a directory");
  }
  const homeOverride = env["HUNTLINE_HOME"];
  const fallback = homeOverride !== undefined && homeOverride !== "" ? homeOverride : ".";
  const target = path.resolve(cwd, requested ?? fallback);
  const force = argv.includes("--force");
  const existing = Object.keys(SCAFFOLD_FILES).filter((name) =>
    existsSync(path.join(target, name)),
  );
  if (existing.length > 0 && !force) {
    return failure("already-exists", `refusing to overwrite ${existing.join(", ")} in ${target}`, {
      recoveryAction: "re-run with --force to overwrite the scaffold files",
    });
  }
  await withLock(target, () => {
    for (const [name, content] of Object.entries(SCAFFOLD_FILES)) {
      writeAtomic(path.join(target, name), content);
    }
    return Promise.resolve();
  });
  return success({
    dataDir: target,
    written: Object.keys(SCAFFOLD_FILES),
    overwritten: force ? existing : [],
    next: `fill every ${MARKER} marker, then run huntline doctor`,
  });
}
