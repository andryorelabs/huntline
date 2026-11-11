/** The product name, used for env vars, files and directories. */
export const PRODUCT_NAME = "jobship";

const PREFIX = "JOBSHIP_";

type Env = Readonly<Record<string, string | undefined>>;

/** A setting read from the environment, with the variable name it came from. */
export type EnvSetting = { readonly name: string; readonly value: string };

/** Reads `JOBSHIP_<suffix>`. An empty value counts as unset. */
export function readSetting(env: Env, suffix: string): EnvSetting | undefined {
  const name = `${PREFIX}${suffix}`;
  const value = env[name];
  return value !== undefined && value !== "" ? { name, value } : undefined;
}

/** The value of {@link readSetting}, without the variable name. */
export function settingValue(env: Env, suffix: string): string | undefined {
  return readSetting(env, suffix)?.value;
}
