import type { ApplicationState, EmailClass } from "../core/types.ts";

export const EMAIL_CLASSES = ["rejection", "interview", "info-request", "offer", "other"] as const;

export type ClassifiedEmail = {
  readonly messageId: string;
  readonly threadId: string;
  readonly from: string;
  readonly subject: string;
  readonly classification: EmailClass;
};

export type MatchBand = "high" | "medium" | "none";
export const MATCH_REASONS = [
  "thread",
  "sender-domain",
  "sender-name",
  "subject",
  "ambiguous",
  "none",
] as const;
export type MatchReason = (typeof MATCH_REASONS)[number];

export type ProposedChange = {
  readonly messageId: string;
  readonly threadId: string;
  readonly classification: EmailClass;
  readonly key: string | null;
  readonly candidates: readonly string[];
  readonly band: MatchBand;
  readonly reason: MatchReason;
  readonly confirmed: boolean;
  readonly targetState: ApplicationState | null;
};

export type ApplicationRecord = {
  readonly key: string;
  readonly company: string;
  readonly state: ApplicationState | null;
};
