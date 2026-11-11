/**
 * Recorded minimum "All files" coverage, as whole percents. Set to the measured value rounded
 * down; raise it when coverage rises, never lower it.
 */
export const COVERAGE_LIMITS = { lines: 91, functions: 92 } as const;

/**
 * Outcome of comparing Bun's coverage table with the recorded limits.
 */
export interface ThresholdResult {
  readonly ok: boolean;
  readonly lines: number | undefined;
  readonly functions: number | undefined;
  readonly failures: readonly string[];
}

const allFilesRow = /^\s*All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/m;

/**
 * Reads the "All files" row of Bun's text coverage table (functions first, then lines) and
 * fails for each metric below its limit, or when the row is missing.
 */
export function checkThreshold(
  table: string,
  limits: { lines: number; functions: number },
): ThresholdResult {
  const match = allFilesRow.exec(table);
  if (match === null) {
    return {
      ok: false,
      lines: undefined,
      functions: undefined,
      failures: ['The coverage table has no "All files" row.'],
    };
  }
  const functions = Number(match[1]);
  const lines = Number(match[2]);
  const failures: string[] = [];
  if (lines < limits.lines) {
    failures.push(`Line coverage ${lines}% is below the ${limits.lines}% threshold.`);
  }
  if (functions < limits.functions) {
    failures.push(`Function coverage ${functions}% is below the ${limits.functions}% threshold.`);
  }
  return { ok: failures.length === 0, lines, functions, failures };
}
