import {
  CONTRACT_TYPES,
  type ContractType,
  type Dimension,
  type Eligibility,
  type Posting,
  type Profile,
  type RejectionReason,
  type SalaryPeriod,
} from "../core/types.ts";

export type GateEvaluation = {
  readonly eligibility: Record<Dimension, Eligibility>;
  readonly dismissed: boolean;
  readonly reason?: RejectionReason;
};

const DISMISSAL_ORDER: readonly Dimension[] = [
  "company",
  "region",
  "remote",
  "contract",
  "stack",
  "salary",
];

const WORLDWIDE_PATTERN = /\b(worldwide|anywhere|global|world[- ]wide)\b/;

const REGION_ALIAS_GROUPS: Readonly<Record<string, readonly string[]>> = {
  us: ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "america"],
  eu: ["eu", "europe", "emea", "european union"],
  uk: ["uk", "united kingdom", "britain", "great britain", "england"],
  latam: [
    "latam",
    "latin america",
    "south america",
    "mexico",
    "colombia",
    "argentina",
    "chile",
    "peru",
    "venezuela",
    "ecuador",
    "guatemala",
    "cuba",
    "bolivia",
    "dominican republic",
    "honduras",
    "paraguay",
    "el salvador",
    "nicaragua",
    "costa rica",
    "panama",
    "uruguay",
    "puerto rico",
    "brazil",
    "brasil",
  ],
  canada: ["canada"],
  apac: ["apac", "asia", "asia pacific"],
  australia: ["australia"],
  india: ["india"],
};

const COMPOSITE_REGION_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "north america": ["us", "canada", "latam"],
  "central america": ["latam"],
};

type AliasEntry = { readonly alias: string; readonly groups: readonly string[] };

const ALIAS_ENTRIES: readonly AliasEntry[] = [
  ...Object.entries(REGION_ALIAS_GROUPS).flatMap(([group, aliases]) =>
    aliases.map((alias) => ({ alias, groups: [group] })),
  ),
  ...Object.entries(COMPOSITE_REGION_ALIASES).map(([alias, groups]) => ({ alias, groups })),
].toSorted((left, right) => right.alias.length - left.alias.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordPattern(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "u");
}

function groupsNamedIn(text: string): Set<string> {
  const groups = new Set<string>();
  let remaining = text;
  for (const { alias, groups: aliasGroups } of ALIAS_ENTRIES) {
    const pattern = wholeWordPattern(alias);
    if (pattern.test(remaining)) {
      for (const group of aliasGroups) groups.add(group);
      remaining = remaining.replace(new RegExp(pattern.source, "gu"), " ");
    }
  }
  return groups;
}

function groupsOfRegion(region: string): Set<string> {
  const groups = new Set<string>();
  for (const { alias, groups: aliasGroups } of ALIAS_ENTRIES) {
    if (alias === region) {
      for (const group of aliasGroups) groups.add(group);
    }
  }
  return groups;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isBlank(text: string | undefined): boolean {
  return text === undefined || normalize(text) === "";
}

function companyGate(profile: Profile, posting: Posting): Eligibility {
  if (isBlank(posting.company)) {
    return "unknown";
  }
  const company = normalize(posting.company);
  const excluded = profile.excludedCompanies.some((entry) => normalize(entry) === company);
  return excluded ? "ineligible" : "eligible";
}

function regionGate(profile: Profile, posting: Posting): Eligibility {
  if (isBlank(posting.location)) {
    return "unknown";
  }
  const location = normalize(posting.location ?? "");
  const locationGroups = groupsNamedIn(location);
  const matchesProfile = profile.regions.some((region) => {
    const needle = normalize(region);
    if (needle === "") {
      return false;
    }
    const sharesGroup = [...groupsOfRegion(needle)].some((group) => locationGroups.has(group));
    return sharesGroup || wholeWordPattern(needle).test(location);
  });
  if (matchesProfile || WORLDWIDE_PATTERN.test(location)) {
    return "eligible";
  }
  return locationGroups.size > 0 ? "ineligible" : "unknown";
}

function remoteGate(profile: Profile, posting: Posting): Eligibility {
  if (posting.remote === undefined) {
    return "unknown";
  }
  if (profile.remote === "remote-only") {
    return posting.remote ? "eligible" : "ineligible";
  }
  return "eligible";
}

function toContractType(raw: string): ContractType | undefined {
  const candidate = normalize(raw).replace(/[_\s]+/g, "-");
  const compact = candidate.replace(/-/g, "");
  return CONTRACT_TYPES.find((type) => type === candidate || type.replace(/-/g, "") === compact);
}

function contractGate(profile: Profile, posting: Posting): Eligibility {
  if (isBlank(posting.contract)) {
    return "unknown";
  }
  const type = toContractType(posting.contract ?? "");
  if (type === undefined) {
    return "unknown";
  }
  return profile.contractTypes.includes(type) ? "eligible" : "ineligible";
}

function stackGate(profile: Profile, posting: Posting): Eligibility {
  const stack = (posting.stack ?? []).map(normalize).filter((entry) => entry !== "");
  if (stack.length === 0) {
    return "unknown";
  }
  const excluded = new Set(profile.stack.exclude.map(normalize));
  if (stack.some((entry) => excluded.has(entry))) {
    return "ineligible";
  }
  const included = new Set(profile.stack.include.map(normalize));
  if (included.size === 0) {
    return "eligible";
  }
  return stack.some((entry) => included.has(entry)) ? "eligible" : "ineligible";
}

function yearly(amount: number, period: SalaryPeriod): number {
  return period === "month" ? amount * 12 : amount;
}

function salaryGate(profile: Profile, posting: Posting): Eligibility {
  const salary = posting.salary;
  const offered = salary?.max ?? salary?.min;
  if (salary === undefined || offered === undefined || !Number.isFinite(offered)) {
    return "unknown";
  }
  const floor = profile.salaryFloor;
  if (floor === null) {
    return "eligible";
  }
  if (isBlank(salary.currency) || normalize(salary.currency ?? "") !== normalize(floor.currency)) {
    return "unknown";
  }
  if (salary.period === undefined) {
    return "unknown";
  }
  return yearly(offered, salary.period) < yearly(floor.amount, floor.period ?? "year")
    ? "ineligible"
    : "eligible";
}

export function evaluateGates(profile: Profile, posting: Posting): GateEvaluation {
  const eligibility: Record<Dimension, Eligibility> = {
    remote: remoteGate(profile, posting),
    region: regionGate(profile, posting),
    contract: contractGate(profile, posting),
    stack: stackGate(profile, posting),
    salary: salaryGate(profile, posting),
    company: companyGate(profile, posting),
  };
  const failing = DISMISSAL_ORDER.find((dimension) => eligibility[dimension] === "ineligible");
  if (failing === undefined) {
    return { eligibility, dismissed: false };
  }
  return { eligibility, dismissed: true, reason: failing };
}
