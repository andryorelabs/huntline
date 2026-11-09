import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CommandContext } from "./commands.ts";
import { loadProfile } from "./data-dir.ts";
import { failure, success, type Envelope } from "./envelope.ts";
import { MARKER } from "./init.ts";
import type { DataDir } from "./types.ts";

const SCANNED_EXTENSIONS = new Set([".yaml", ".yml", ".json"]);

type MarkerHit = { readonly file: string; readonly line: number };

export function findMarkers(dir: DataDir): MarkerHit[] {
  const hits: MarkerHit[] = [];
  const names = readdirSync(dir.path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name)))
    .map((entry) => entry.name)
    .toSorted();
  for (const name of names) {
    const lines = readFileSync(path.join(dir.path, name), "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      if (line.includes(MARKER)) hits.push({ file: name, line: index + 1 });
    }
  }
  return hits;
}

export function runDoctor(ctx: CommandContext): Envelope<unknown> {
  if (ctx.dataDir === null) {
    return failure(
      "data-dir-not-found",
      "no data directory: pass --data, set HUNTLINE_HOME or run inside a directory with huntline.json",
      { recoveryAction: "run huntline init in an empty directory" },
    );
  }
  const profile = loadProfile(ctx.dataDir);
  if (!profile.ok) {
    return failure(profile.error.code, profile.error.message, {
      recoveryAction: "fix the named field in profile.yaml",
    });
  }
  const markers = findMarkers(ctx.dataDir);
  if (markers.length > 0) {
    const listed = markers.map((hit) => `${hit.file}:${hit.line}`).join(", ");
    return failure("todo-markers", `${markers.length} ${MARKER} markers remain: ${listed}`, {
      recoveryAction: `replace each ${MARKER} marker with your own data`,
    });
  }
  return success({
    dataDir: ctx.dataDir.path,
    tracker: profile.value.tracker.kind,
    sources: profile.value.sources.length,
    markers: 0,
  });
}
