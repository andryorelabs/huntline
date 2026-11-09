import type { CommandContext } from "../core/commands.ts";
import { loadProfile } from "../core/data-dir.ts";
import { errorMessage } from "../core/narrow.ts";
import type { Liveness, Result } from "../core/types.ts";
import { appendEvent, readEvents } from "../ledger/events.ts";
import { createTracker, projectEvents } from "../tracker/index.ts";
import type { ScoreInput } from "./types.ts";

export function normalizeLiveness(input: ScoreInput): Liveness {
  if (input.livenessError !== undefined) return "unknown";
  return input.liveness === "live" || input.liveness === "closed" ? input.liveness : "unknown";
}

function fail(code: string, message: string): Result<void> {
  return { ok: false, error: { code, message } };
}

function validate(score: ScoreInput): string | null {
  if (!Number.isInteger(score.score) || score.score < 0 || score.score > 100) {
    return "score must be an integer from 0 to 100";
  }
  if (score.reasons.some((reason) => reason.trim() === "")) return "reasons must be non-empty strings";
  return null;
}

export async function recordScore(
  ctx: CommandContext,
  key: string,
  score: ScoreInput,
): Promise<Result<void>> {
  if (ctx.dataDir === null) {
    return fail("data-dir-not-found", "no data dir resolved; pass --data or set HUNTLINE_HOME");
  }
  const problem = validate(score);
  if (problem !== null) return fail("usage", problem);
  const dir = ctx.dataDir;
  const existing = await readEvents(dir, key);
  if (existing.length === 0) return fail("not-found", `no events for key ${key}`);
  const profile = loadProfile(dir);
  if (!profile.ok) return profile;
  const stored = await appendEvent(dir, {
    kind: "score.recorded",
    key,
    score: score.score,
    reasons: [...score.reasons],
    liveness: normalizeLiveness(score),
  });
  try {
    const projected = await projectEvents(
      createTracker(profile.value.tracker, dir, { apiKey: ctx.env["LINEAR_API_KEY"] }),
      dir,
      [...existing, stored],
    );
    if (!projected.ok) {
      return fail(projected.error.code, `score recorded but not projected: ${projected.error.message}`);
    }
  } catch (error) {
    return fail("tracker-projection-failed", `score recorded but not projected: ${errorMessage(error)}`);
  }
  return { ok: true, value: undefined };
}
