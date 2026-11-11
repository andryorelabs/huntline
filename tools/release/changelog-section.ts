import { readFileSync } from "node:fs";
import path from "node:path";

const CHANGELOG_PATH = path.join(import.meta.dir, "..", "..", "CHANGELOG.md");
const SECTION_HEADING = /^## \[([^\]]+)\]/;
const LINK_REFERENCE = /^\[[^\]]+\]: /;

/**
 * Returns the body of the `CHANGELOG.md` section for a release tag, without its heading.
 * The tag may carry a leading `v`. Throws when the section is missing or has no content,
 * so a release is never published with empty notes.
 */
export function extractChangelogSection(changelog: string, tag: string): string {
  const version = tag.replace(/^v/, "");
  const lines = changelog.split("\n");
  const start = /^\d/.test(version)
    ? lines.findIndex((line) => SECTION_HEADING.exec(line)?.[1] === version)
    : -1;
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no section for ${tag}`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => SECTION_HEADING.test(line) || LINK_REFERENCE.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  if (body === "") {
    throw new Error(`CHANGELOG.md section for ${tag} is empty`);
  }
  return body;
}

/** Prints the section for the tag given as the only argument; exits 1 with a reason otherwise. */
function main(args: readonly string[]): void {
  const [tag] = args;
  if (tag === undefined || args.length !== 1) {
    process.stderr.write("Usage: bun tools/release/changelog-section.ts <tag>\n");
    process.exit(1);
  }
  try {
    process.stdout.write(`${extractChangelogSection(readFileSync(CHANGELOG_PATH, "utf8"), tag)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
