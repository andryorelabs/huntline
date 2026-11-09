import {
  CONTRACT_TYPES,
  type ContractType,
  type Dimension,
  type Eligibility,
  type Posting,
  type Profile,
  type RejectionReason,
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
const RESTRICTED_REGION_PATTERN =
  /\bonly\b|\b(us|usa|u\.s\.|united states|europe|eu|emea|uk|united kingdom|canada|apac|asia|australia|india)\b/;

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
  const matchesProfile = profile.regions.some((region) => {
    const needle = normalize(region);
    return needle !== "" && location.includes(needle);
  });
  if (matchesProfile || WORLDWIDE_PATTERN.test(location)) {
    return "eligible";
  }
  return RESTRICTED_REGION_PATTERN.test(location) ? "ineligible" : "unknown";
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
  return offered < floor.amount ? "ineligible" : "eligible";
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
