import type { Bullet, Coverage, FactBank } from "./types.ts";

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentions(haystack: string, needle: string): boolean {
  const term = normalize(needle);
  if (term === "") return false;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "u");
  return pattern.test(normalize(haystack));
}

export function selectBullets(
  bullets: Bullet[],
  selector: { tags?: string[]; requirements?: string[] },
): Bullet[] {
  const tags = (selector.tags ?? []).map(normalize);
  const tagSet = new Set(tags);
  const requirements = selector.requirements ?? [];
  if (tags.length === 0 && requirements.length === 0) return [...bullets];
  return bullets.filter((bullet) => {
    const bulletTags = bullet.tags.map(normalize);
    if (bulletTags.some((tag) => tagSet.has(tag))) return true;
    return requirements.some(
      (requirement) =>
        bulletTags.includes(normalize(requirement)) || mentions(bullet.text, requirement),
    );
  });
}

export function requirementCoverage(requirements: string[], facts: FactBank): Coverage {
  const covered: Coverage["covered"] = [];
  const missing: string[] = [];
  for (const requirement of requirements) {
    const factIds = facts.facts
      .filter(
        (fact) =>
          fact.tags.some((tag) => normalize(tag) === normalize(requirement)) ||
          mentions(fact.text, requirement),
      )
      .map((fact) => fact.id);
    if (factIds.length === 0) missing.push(requirement);
    else covered.push({ requirement, factIds });
  }
  return { covered, missing };
}
