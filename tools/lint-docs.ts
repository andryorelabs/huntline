import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const EXTERNAL_TARGET = /^([a-z][a-z0-9+.-]*:|#|\/\/)/i;
const IGNORED_DIRECTORIES: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  ".claude",
]);

export type BrokenLink = { readonly file: string; readonly line: number; readonly target: string };

/**
 * Lists the markdown files under a directory, skipping dependency and build folders.
 * @param root The directory to walk.
 * @returns Absolute paths of every `.md` file found.
 */
export function listMarkdownFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...listMarkdownFiles(full));
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

/**
 * Finds relative markdown links whose target file or directory does not exist.
 * Absolute URLs and pure `#anchor` links are ignored.
 * @param file The markdown file to scan.
 * @returns One entry per broken link, with its line number.
 */
export function findBrokenLinks(file: string): BrokenLink[] {
  const broken: BrokenLink[] = [];
  const lines = readFileSync(file, "utf8").split("\n");
  let inFence = false;
  lines.forEach((text, index) => {
    if (text.trimStart().startsWith("```")) inFence = !inFence;
    if (inFence) return;
    for (const match of text.matchAll(MARKDOWN_LINK)) {
      const target = match[1] ?? "";
      if (EXTERNAL_TARGET.test(target)) continue;
      const withoutFragment = decodeURI(target.split("#")[0] ?? "");
      if (withoutFragment === "") continue;
      const resolved = path.resolve(path.dirname(file), withoutFragment);
      if (existsSync(resolved)) continue;
      broken.push({ file, line: index + 1, target });
    }
  });
  return broken;
}

if (import.meta.main) {
  const root = process.cwd();
  const broken = listMarkdownFiles(root).flatMap(findBrokenLinks);
  for (const link of broken) {
    console.error(`${path.relative(root, link.file)}:${link.line}: broken link ${link.target}`);
  }
  process.exit(broken.length === 0 ? 0 : 1);
}
