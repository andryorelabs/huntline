import path from "node:path";
import type { FieldDump, IntendedField, VerifyFinding } from "./types.ts";

function baseName(value: string): string {
  return path.basename(value.replaceAll("\\", "/"));
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function verifyFields(
  intended: readonly IntendedField[],
  dump: readonly FieldDump[],
): VerifyFinding[] {
  const findings: VerifyFinding[] = [];
  for (const field of intended) {
    const actual = dump.find((entry) => entry.name === field.name);
    if (actual === undefined) {
      findings.push({ field: field.name, class: "missing", expected: field.value, actual: null });
      continue;
    }
    if (field.kind === "file") {
      if (baseName(actual.value) !== baseName(field.value)) {
        findings.push({
          field: field.name,
          class: "file-name-mismatch",
          expected: baseName(field.value),
          actual: baseName(actual.value),
        });
      }
      continue;
    }
    if (collapse(actual.value) !== collapse(field.value)) {
      findings.push({
        field: field.name,
        class: "value-mismatch",
        expected: field.value,
        actual: actual.value,
      });
    }
  }
  return findings;
}
