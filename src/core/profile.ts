import { isObject, isOneOf } from "./narrow.ts";
import {
  APPLICATION_STATES,
  CONTRACT_TYPES,
  SALARY_PERIODS,
  TITLE_FORMATS,
  REMOTE_PREFERENCES,
  TRACKER_KINDS,
  type ContractType,
  type Profile,
  type Result,
  type TrackerConfig,
} from "./types.ts";

const PROFILE_KEYS = [
  "regions",
  "contractTypes",
  "remote",
  "stack",
  "salaryFloor",
  "excludedCompanies",
  "outreachDailyCap",
  "sources",
  "tracker",
] as const;

type Checked<T> = { readonly value: T } | { readonly problem: string };

function fail(field: string, expectation: string): { problem: string } {
  return { problem: `${field}: ${expectation}` };
}

function checkStringList(value: unknown, field: string): Checked<readonly string[]> {
  if (!Array.isArray(value)) return fail(field, "must be a list of strings");
  const items: unknown[] = value;
  for (const [index, item] of items.entries()) {
    if (typeof item !== "string" || item.trim() === "") {
      return fail(`${field}[${index}]`, "must be a non-empty string");
    }
  }
  return { value: items.filter((item): item is string => typeof item === "string") };
}

function checkContractTypes(value: unknown): Checked<readonly ContractType[]> {
  if (!Array.isArray(value)) return fail("contractTypes", "must be a list");
  const items: unknown[] = value;
  const accepted: ContractType[] = [];
  for (const [index, item] of items.entries()) {
    if (!isOneOf(CONTRACT_TYPES, item)) {
      return fail(
        `contractTypes[${index}]`,
        `unknown contract type ${JSON.stringify(item)}; use one of ${CONTRACT_TYPES.join(", ")}`,
      );
    }
    accepted.push(item);
  }
  return { value: accepted };
}

function checkStack(value: unknown): Checked<Profile["stack"]> {
  if (!isObject(value)) return fail("stack", "must be an object with include and exclude lists");
  const include = checkStringList(value["include"], "stack.include");
  if ("problem" in include) return include;
  const exclude = checkStringList(value["exclude"], "stack.exclude");
  if ("problem" in exclude) return exclude;
  return { value: { include: include.value, exclude: exclude.value } };
}

function checkSalaryFloor(value: unknown): Checked<Profile["salaryFloor"]> {
  if (value === null) return { value: null };
  if (!isObject(value)) return fail("salaryFloor", "must be null or {amount, currency}");
  const { amount, currency, period } = value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return fail("salaryFloor.amount", "must be a non-negative number");
  }
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    return fail("salaryFloor.currency", "must be a three-letter uppercase code");
  }
  if (period !== undefined && !isOneOf(SALARY_PERIODS, period)) {
    return fail("salaryFloor.period", `must be one of ${SALARY_PERIODS.join(", ")}`);
  }
  return { value: { amount, currency, ...(period === undefined ? {} : { period }) } };
}

function checkStringMap(
  value: unknown,
  field: string,
  allowedKeys?: readonly string[],
): Checked<Record<string, string>> {
  if (!isObject(value)) return fail(field, "must be an object of non-empty strings");
  const entries: [string, string][] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (allowedKeys !== undefined && !allowedKeys.includes(key)) {
      return fail(`${field}.${key}`, `unknown key; use one of ${allowedKeys.join(", ")}`);
    }
    if (typeof entry !== "string" || entry.trim() === "") {
      return fail(`${field}.${key}`, "must be a non-empty string");
    }
    entries.push([key, entry]);
  }
  return { value: Object.fromEntries(entries) };
}

function checkTracker(value: unknown): Checked<TrackerConfig> {
  if (!isObject(value)) return fail("tracker", "must be an object with a kind");
  const { kind, directory, team, states, channelLabels, channelLabelPrefix, titleFormat } = value;
  if (!isOneOf(TRACKER_KINDS, kind)) {
    return fail("tracker.kind", `must be one of ${TRACKER_KINDS.join(", ")}`);
  }
  if (directory !== undefined && typeof directory !== "string") {
    return fail("tracker.directory", "must be a string");
  }
  if (team !== undefined && typeof team !== "string")
    return fail("tracker.team", "must be a string");
  const checkedStates =
    states === undefined ? undefined : checkStringMap(states, "tracker.states", APPLICATION_STATES);
  if (checkedStates !== undefined && "problem" in checkedStates) return checkedStates;
  const checkedLabels =
    channelLabels === undefined
      ? undefined
      : checkStringMap(channelLabels, "tracker.channelLabels");
  if (checkedLabels !== undefined && "problem" in checkedLabels) return checkedLabels;
  if (channelLabelPrefix !== undefined && typeof channelLabelPrefix !== "string") {
    return fail("tracker.channelLabelPrefix", "must be a string");
  }
  if (titleFormat !== undefined && !isOneOf(TITLE_FORMATS, titleFormat)) {
    return fail("tracker.titleFormat", `must be one of ${TITLE_FORMATS.join(", ")}`);
  }
  return {
    value: {
      kind,
      ...(directory === undefined ? {} : { directory }),
      ...(team === undefined ? {} : { team }),
      ...(checkedStates === undefined ? {} : { states: checkedStates.value }),
      ...(checkedLabels === undefined ? {} : { channelLabels: checkedLabels.value }),
      ...(channelLabelPrefix === undefined ? {} : { channelLabelPrefix }),
      ...(titleFormat === undefined ? {} : { titleFormat }),
    },
  };
}

function failed(message: string): Result<Profile> {
  return { ok: false, error: { code: "profile-malformed", message } };
}

export function validateProfile(raw: unknown): Result<Profile> {
  if (!isObject(raw)) return failed("profile: must be a mapping at the top level");
  const unknownKey = Object.keys(raw).find((key) => !isOneOf(PROFILE_KEYS, key));
  if (unknownKey !== undefined) return failed(`${unknownKey}: unknown field`);

  const regions = checkStringList(raw["regions"], "regions");
  if ("problem" in regions) return failed(regions.problem);
  const contractTypes = checkContractTypes(raw["contractTypes"]);
  if ("problem" in contractTypes) return failed(contractTypes.problem);
  const remote = raw["remote"];
  if (!isOneOf(REMOTE_PREFERENCES, remote)) {
    return failed(`remote: must be one of ${REMOTE_PREFERENCES.join(", ")}`);
  }
  const stack = checkStack(raw["stack"]);
  if ("problem" in stack) return failed(stack.problem);
  const salaryFloor = checkSalaryFloor(raw["salaryFloor"]);
  if ("problem" in salaryFloor) return failed(salaryFloor.problem);
  const excludedCompanies = checkStringList(raw["excludedCompanies"], "excludedCompanies");
  if ("problem" in excludedCompanies) return failed(excludedCompanies.problem);
  const outreachDailyCap = raw["outreachDailyCap"];
  if (
    typeof outreachDailyCap !== "number" ||
    !Number.isInteger(outreachDailyCap) ||
    outreachDailyCap < 0
  ) {
    return failed("outreachDailyCap: must be a non-negative integer");
  }
  const sources = checkStringList(raw["sources"], "sources");
  if ("problem" in sources) return failed(sources.problem);
  const tracker = checkTracker(raw["tracker"]);
  if ("problem" in tracker) return failed(tracker.problem);

  return {
    ok: true,
    value: {
      regions: regions.value,
      contractTypes: contractTypes.value,
      remote,
      stack: stack.value,
      salaryFloor: salaryFloor.value,
      excludedCompanies: excludedCompanies.value,
      outreachDailyCap,
      sources: sources.value,
      tracker: tracker.value,
    },
  };
}
