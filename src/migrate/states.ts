import { APPLICATION_STATES, type ApplicationState } from "../core/types.ts";

const STATE_ALIASES: Readonly<Record<string, ApplicationState>> = {
  todo: "to-apply",
  "to do": "to-apply",
  "to apply": "to-apply",
  backlog: "lead",
  submitted: "applied",
  "in progress": "applied",
  "phone screen": "screening",
  interview: "interviewing",
  interviews: "interviewing",
  accepted: "hired",
  done: "hired",
  declined: "rejected",
  canceled: "discarded",
  cancelled: "discarded",
  skipped: "discarded",
  closed: "discarded",
};

const VERDICT_ALIASES: Readonly<Record<string, ApplicationState | null>> = {
  apply: "to-apply",
  pursue: "to-apply",
  skip: "discarded",
  pass: "discarded",
  discard: "discarded",
  maybe: null,
  hold: null,
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function mapState(text: string): ApplicationState | null {
  const normalized = normalize(text);
  const direct = APPLICATION_STATES.find((state) => normalize(state) === normalized);
  if (direct !== undefined) return direct;
  return STATE_ALIASES[normalized] ?? null;
}

export type VerdictOutcome = { readonly known: boolean; readonly state: ApplicationState | null };

export function mapVerdict(text: string): VerdictOutcome {
  const normalized = normalize(text);
  if (normalized === "") return { known: true, state: null };
  if (Object.hasOwn(VERDICT_ALIASES, normalized)) {
    return { known: true, state: VERDICT_ALIASES[normalized] ?? null };
  }
  const state = mapState(text);
  return { known: state !== null, state };
}
