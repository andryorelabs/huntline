import type { Bullet, Coverage, FactBank } from "./types.ts";

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(haystack: string, needle: string): boolean {
  const term = normalize(needle);
  if (term === "") return false;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "u");
  return pattern.test(normalize(haystack));
}

function matchesRule(
  bullet: Bullet,
  rule: { all?: readonly string[]; any?: readonly string[]; none?: readonly string[] },
): boolean {
  const bulletTags = new Set(bullet.tags.map(normalize));
  const all = (rule.all ?? []).map(normalize);
  const any = (rule.any ?? []).map(normalize);
  const none = (rule.none ?? []).map(normalize);
  if (!all.every((tag) => bulletTags.has(tag))) return false;
  if (any.length > 0 && !any.some((tag) => bulletTags.has(tag))) return false;
  return !none.some((tag) => bulletTags.has(tag));
}

export function selectBullets(
  bullets: Bullet[],
  selector: {
    all?: readonly string[];
    any?: readonly string[];
    none?: readonly string[];
    tags?: string[];
    requirements?: string[];
  },
): Bullet[] {
  const ruled = bullets.filter((bullet) => matchesRule(bullet, selector));
  const tags = (selector.tags ?? []).map(normalize);
  const tagSet = new Set(tags);
  const requirements = selector.requirements ?? [];
  if (tags.length === 0 && requirements.length === 0) return ruled;
  return ruled.filter((bullet) => {
    const bulletTags = bullet.tags.map(normalize);
    if (bulletTags.some((tag) => tagSet.has(tag))) return true;
    return requirements.some(
      (requirement) =>
        bulletTags.includes(normalize(requirement)) || mentions(bullet.text, requirement),
    );
  });
}

const STOP_WORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "with",
  "for",
  "years",
  "year",
  "experience",
  "experienced",
  "strong",
  "knowledge",
  "working",
  "work",
  "using",
  "ability",
  "skills",
  "skill",
  "good",
  "great",
  "plus",
]);

function significantWords(phrase: string): string[] {
  return normalize(phrase)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

export function requirementCoverage(requirements: string[], facts: FactBank): Coverage {
  const covered: Coverage["covered"] = [];
  const missing: string[] = [];
  for (const requirement of requirements) {
    const words = significantWords(requirement);
    const factIds = facts.facts
      .filter(
        (fact) =>
          fact.tags.some(
            (tag) => normalize(tag) === normalize(requirement) || words.includes(normalize(tag)),
          ) || mentions(fact.text, requirement),
      )
      .map((fact) => fact.id);
    if (factIds.length === 0) missing.push(requirement);
    else covered.push({ requirement, factIds });
  }
  return { covered, missing };
}
