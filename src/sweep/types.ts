import type { SourceAdapter, TrackerAdapter } from "../core/types.ts";

export type SweepOptions = {
  readonly only?: readonly string[];
  readonly keywords?: readonly string[];
  readonly adapters?: Readonly<Record<string, SourceAdapter>>;
  readonly tracker?: TrackerAdapter;
};

export type SourceCounts = {
  readonly seen: number;
  readonly known: number;
  readonly new: number;
  readonly dismissed: number;
};

export type TrackerSummary = {
  readonly created: number;
  readonly updated: number;
  readonly error?: string;
};

export type SourceReport = SourceCounts & {
  readonly source: string;
  readonly status: "ok" | "empty" | "failed" | "misconfigured";
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
};

export type SweepReport = {
  readonly sources: readonly SourceReport[];
  readonly failed: readonly { readonly source: string; readonly errors: readonly string[] }[];
  readonly empty: readonly string[];
  readonly misconfigured: readonly string[];
  readonly totals: SourceCounts;
  readonly leads: readonly string[];
  readonly tracker: TrackerSummary;
};

export type IngestReport = SourceCounts & {
  readonly source: string;
  readonly leads: readonly string[];
  readonly tracker: TrackerSummary;
};

export type ScoreInput = {
  readonly score: number;
  readonly reasons: readonly string[];
  readonly liveness?: string;
  readonly livenessError?: string;
};
