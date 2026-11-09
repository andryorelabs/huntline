export type AtsRef = { readonly ats: string; readonly slug: string };

const ATS_PATTERNS: readonly { readonly ats: string; readonly pattern: RegExp }[] = [
  { ats: "greenhouse", pattern: /^https?:\/\/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i },
  { ats: "lever", pattern: /^https?:\/\/jobs(?:\.eu)?\.lever\.co\/([\w-]+)/i },
  { ats: "ashby", pattern: /^https?:\/\/jobs\.ashbyhq\.com\/([\w.%-]+)/i },
  { ats: "workable", pattern: /^https?:\/\/apply\.workable\.com\/([\w-]+)/i },
  { ats: "smartrecruiters", pattern: /^https?:\/\/(?:jobs|careers)\.smartrecruiters\.com\/([\w-]+)/i },
];

const SAFE_SLUG = /^[\w.-]+$/;

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function detectAts(url: string): AtsRef | null {
  const trimmed = url.trim();
  for (const { ats, pattern } of ATS_PATTERNS) {
    const slug = pattern.exec(trimmed)?.[1];
    if (slug === undefined || slug === "embed") continue;
    const decoded = safeDecode(slug);
    if (decoded !== null && SAFE_SLUG.test(decoded) && decoded !== "." && decoded !== "..") return { ats, slug: decoded };
  }
  return null;
}
