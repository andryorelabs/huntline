import { existsSync } from "node:fs";
import path from "node:path";
import type { DataDir, Result } from "../core/types.ts";
import { loadIdentityFields, type IdentityField } from "./dossier.ts";

const IDENTITY_FILE = "dossier/identity.md";

/** Loads the identity fields, treating a data directory without a Dossier as having none. */
export function loadIdentityIfPresent(dir: DataDir): Result<IdentityField[]> {
  if (!existsSync(path.join(dir.path, IDENTITY_FILE))) return { ok: true, value: [] };
  return loadIdentityFields(dir);
}
