import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeAtomic, withLock } from "../core/fs.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import type { DataDir, Result } from "../core/types.ts";
import type { AtsRef } from "./detect.ts";

const COMPANIES_FILE = "companies.json";

export function readCompanies(dir: DataDir): Result<AtsRef[]> {
  const file = path.join(dir.path, COMPANIES_FILE);
  if (!existsSync(file)) return { ok: true, value: [] };
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    const list = isObject(parsed) ? parsed["companies"] : undefined;
    if (!Array.isArray(list)) throw new Error("expected an object with a companies array");
    const entries: AtsRef[] = [];
    for (const entry of list) {
      if (
        !isObject(entry) ||
        typeof entry["ats"] !== "string" ||
        typeof entry["slug"] !== "string"
      ) {
        throw new Error("every company needs string ats and slug fields");
      }
      entries.push({ ats: entry["ats"], slug: entry["slug"] });
    }
    return { ok: true, value: entries };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "companies-malformed",
        message: `${COMPANIES_FILE} is invalid: ${errorMessage(error)}`,
      },
    };
  }
}

export type AddOutcome = { readonly added: boolean; readonly company: AtsRef };

export async function addCompany(dir: DataDir, company: AtsRef): Promise<Result<AddOutcome>> {
  return withLock<Result<AddOutcome>>(dir.path, () => {
    const current = readCompanies(dir);
    if (!current.ok) return Promise.resolve(current);
    const known = current.value.some(
      (entry) => entry.ats === company.ats && entry.slug === company.slug,
    );
    if (!known) {
      const next = [...current.value, company];
      writeAtomic(
        path.join(dir.path, COMPANIES_FILE),
        `${JSON.stringify({ companies: next }, null, 2)}\n`,
      );
    }
    return Promise.resolve({ ok: true as const, value: { added: !known, company } });
  });
}
