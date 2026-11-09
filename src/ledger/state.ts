import type { ApplicationState, HuntEvent } from "../core/types.ts";

export function foldState(events: readonly HuntEvent[]): ApplicationState | null {
  let state: ApplicationState | null = null;
  for (const event of events) {
    if (event.kind === "lead.created" && state === null) state = "lead";
    else if (event.kind === "status.changed") state = event.to;
    else if (event.kind === "posting.dismissed" && state === null) state = "discarded";
  }
  return state;
}
