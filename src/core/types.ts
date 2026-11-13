export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export type DataDir = { readonly path: string };

export const CONTRACT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "freelance",
  "internship",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const REMOTE_PREFERENCES = ["remote-only", "hybrid", "any"] as const;
type RemotePreference = (typeof REMOTE_PREFERENCES)[number];

export const TRACKER_KINDS = ["local", "linear"] as const;
type TrackerKind = (typeof TRACKER_KINDS)[number];

const DIMENSIONS = ["remote", "region", "contract", "stack", "salary", "company"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const ELIGIBILITIES = ["eligible", "ineligible", "unknown"] as const;
export type Eligibility = (typeof ELIGIBILITIES)[number];

export const REJECTION_REASONS = [
  "closed",
  "remote",
  "region",
  "contract",
  "stack",
  "salary",
  "company",
  "duplicate",
  "other",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const APPLICATION_STATES = [
  "lead",
  "to-apply",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
  "discarded",
] as const;
export type ApplicationState = (typeof APPLICATION_STATES)[number];

export type Liveness = "live" | "closed" | "unknown";
export type EmailClass = "rejection" | "interview" | "info-request" | "offer" | "other";
type BlockerScope = "field" | "section" | "application";

export const SALARY_PERIODS = ["year", "month"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const TITLE_FORMATS = ["role-at-company", "company-role"] as const;
export type TitleFormat = (typeof TITLE_FORMATS)[number];

export type Salary = {
  readonly min?: number;
  readonly max?: number;
  readonly currency?: string;
  readonly period?: SalaryPeriod;
};

export type WorkMode = "remote" | "hybrid" | "onsite";

export type Posting = {
  readonly id: string;
  readonly source: string;
  readonly url: string;
  readonly company: string;
  readonly title: string;
  readonly location?: string;
  readonly remote?: boolean;
  readonly workMode?: WorkMode;
  readonly contract?: string;
  readonly salary?: Salary;
  readonly stack?: readonly string[];
  readonly description?: string;
  readonly postedAt?: string;
};

export type SourceResult = {
  readonly postings: Posting[];
  readonly errors: string[];
  readonly warnings: string[];
  readonly nextCursor?: string;
};

export type SourceQuery = {
  readonly company?: string;
  readonly slug?: string;
  readonly keywords?: readonly string[];
  readonly cursor?: string;
};

export type SourceAdapter = {
  readonly name: string;
  fetch(query: SourceQuery): Promise<SourceResult>;
};

type EventBase = {
  readonly id: string;
  readonly at: string;
  readonly key?: string;
};

export type HuntEvent =
  | (EventBase & {
      readonly kind: "posting.seen";
      readonly posting: Posting;
      readonly eligibility: Eligibility;
    })
  | (EventBase & {
      readonly kind: "posting.dismissed";
      readonly posting: Posting;
      readonly reason: RejectionReason;
    })
  | (EventBase & {
      readonly kind: "lead.created";
      readonly posting: Posting;
      readonly eligibility: Eligibility;
    })
  | (EventBase & {
      readonly kind: "score.recorded";
      readonly score: number;
      readonly reasons: readonly string[];
      readonly liveness: Liveness;
    })
  | (EventBase & {
      readonly kind: "status.changed";
      readonly from?: ApplicationState;
      readonly to: ApplicationState;
    })
  | (EventBase & {
      readonly kind: "blocker.opened";
      readonly blockerId: string;
      readonly scope: BlockerScope;
      readonly detail: string;
    })
  | (EventBase & { readonly kind: "blocker.resolved"; readonly blockerId: string })
  | (EventBase & {
      readonly kind: "cv.built";
      readonly variant: string;
      readonly path: string;
      readonly hash: string;
    })
  | (EventBase & {
      readonly kind: "email.classified";
      readonly messageId: string;
      readonly classification: EmailClass;
    })
  | (EventBase & {
      readonly kind: "outreach.logged";
      readonly channel: string;
      readonly recipient: string;
    })
  | (EventBase & { readonly kind: "note"; readonly text: string });

export type TrackerConfig = {
  readonly kind: TrackerKind;
  readonly directory?: string;
  readonly team?: string;
  readonly states?: Partial<Record<ApplicationState, string>>;
  readonly channelLabels?: Record<string, string>;
  readonly channelLabelPrefix?: string;
  readonly titleFormat?: TitleFormat;
};

export type Profile = {
  readonly regions: readonly string[];
  readonly contractTypes: readonly ContractType[];
  readonly remote: RemotePreference;
  readonly stack: {
    readonly include: readonly string[];
    readonly exclude: readonly string[];
  };
  readonly salaryFloor: {
    readonly amount: number;
    readonly currency: string;
    readonly period?: SalaryPeriod;
  } | null;
  readonly excludedCompanies: readonly string[];
  readonly outreachDailyCap: number;
  readonly sources: readonly string[];
  readonly tracker: TrackerConfig;
};

export type Lead = {
  readonly key: string;
  readonly posting: Posting;
  readonly eligibility: Eligibility;
};

export type TrackerAdapter = {
  upsertLead(lead: Lead): Promise<Result<string>>;
  setStatus(key: string, state: ApplicationState): Promise<Result<void>>;
  comment(key: string, text: string): Promise<Result<void>>;
  find(key: string): Promise<Result<string | null>>;
};
