/** The product name, used for env vars, files and directories. */
export const PRODUCT_NAME = "jobship";

/** The pre-rename name, still read as a fallback. See ADR-0005. */
export const LEGACY_PRODUCT_NAME = "huntline";

const PREFIX = "JOBSHIP_";
const LEGACY_PREFIX = "HUNTLINE_";

type Env = Readonly<Record<string, string | undefined>>;

/** A setting read from the environment, with the variable name it came from. */
export type EnvSetting = { readonly name: string; readonly value: string };

/**
 * Reads `JOBSHIP_<suffix>`, falling back to its legacy `HUNTLINE_<suffix>` twin.
 * An empty value counts as unset.
 */
export function readSetting(env: Env, suffix: string): EnvSetting | undefined {
  for (const name of [`${PREFIX}${suffix}`, `${LEGACY_PREFIX}${suffix}`]) {
    const value = env[name];
    if (value !== undefined && value !== "") return { name, value };
  }
  return undefined;
}

/** The value of {@link readSetting}, without the variable name. */
export function settingValue(env: Env, suffix: string): string | undefined {
  return readSetting(env, suffix)?.value;
}
