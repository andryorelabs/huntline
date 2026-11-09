import { errorMessage } from "../core/narrow.ts";
import type { DataDir, Profile, Result } from "../core/types.ts";
import { appendEvent, readEvents } from "../ledger/events.ts";
import type { OutreachEntry } from "./types.ts";

function utcDay(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export async function countLoggedToday(dir: DataDir, now: Date = new Date()): Promise<number> {
  const today = utcDay(now.toISOString());
  const events = await readEvents(dir);
  return events.filter((event) => event.kind === "outreach.logged" && utcDay(event.at) === today)
    .length;
}

export async function logOutreach(
  dir: DataDir,
  profile: Profile,
  entry: OutreachEntry,
): Promise<Result<void>> {
  try {
    const used = await countLoggedToday(dir);
    if (used >= profile.outreachDailyCap) {
      return {
        ok: false,
        error: {
          code: "daily-cap-reached",
          message: `daily outreach cap of ${profile.outreachDailyCap} reached (${used} logged today)`,
        },
      };
    }
    await appendEvent(dir, {
      kind: "outreach.logged",
      channel: entry.channel,
      recipient: entry.recipient,
      ...(entry.key === undefined ? {} : { key: entry.key }),
    });
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: { code: "internal", message: errorMessage(error) } };
  }
}
