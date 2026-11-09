import type { Result } from "../core/types.ts";

export type ImportReport = {
  readonly source: string;
  readonly created: number;
  readonly skipped: number;
  readonly unknownStates: readonly string[];
  readonly warnings: readonly string[];
};

export type ImportResult = Result<ImportReport>;
