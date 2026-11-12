import { normalizeQuestion } from "./blockers.ts";

export type AnswerKey = string;

type AnswerKeyEntry = {
  readonly key: AnswerKey;
  readonly tier: "A" | "B" | "D";
  readonly phrasings: readonly string[];
};

/**
 * The fixed catalog of recurring form questions. Tier D keys are identity data
 * that is never pre-filled: they always abstain.
 */
export const ANSWER_KEYS: readonly AnswerKeyEntry[] = [
  {
    key: "work-authorization-us",
    tier: "B",
    phrasings: [
      "authorized to work in the united states",
      "authorized to work in the us",
      "work authorization united states",
      "work authorization us",
      "legally eligible to work in the us",
    ],
  },
  {
    key: "work-authorization-uk",
    tier: "B",
    phrasings: [
      "authorized to work in the united kingdom",
      "authorized to work in the uk",
      "right to work in the uk",
      "work authorization united kingdom",
    ],
  },
  {
    key: "work-authorization-eu",
    tier: "B",
    phrasings: [
      "authorized to work in the european union",
      "authorized to work in the eu",
      "right to work in the eu",
      "work authorization european union",
    ],
  },
  {
    key: "work-authorization-ca",
    tier: "B",
    phrasings: [
      "authorized to work in canada",
      "legally eligible to work in canada",
      "work authorization canada",
    ],
  },
  {
    key: "sponsorship",
    tier: "B",
    phrasings: [
      "require sponsorship",
      "visa sponsorship",
      "require visa sponsorship",
      "need sponsorship",
      "sponsorship now or in the future",
    ],
  },
  {
    key: "salary-expectation",
    tier: "A",
    phrasings: [
      "salary expectation",
      "salary expectations",
      "expected salary",
      "desired salary",
      "compensation expectations",
      "salary requirements",
    ],
  },
  {
    key: "notice-period",
    tier: "A",
    phrasings: ["notice period", "current notice period", "how much notice"],
  },
  {
    key: "start-date",
    tier: "A",
    phrasings: [
      "start date",
      "earliest start date",
      "when can you start",
      "how soon can you start",
      "available to start",
    ],
  },
  {
    key: "location",
    tier: "A",
    phrasings: [
      "current location",
      "where are you located",
      "where do you live",
      "city and country",
      "what is your location",
    ],
  },
  {
    key: "remote",
    tier: "A",
    phrasings: ["work remotely", "comfortable working remotely", "remote or on site"],
  },
  {
    key: "relocation",
    tier: "A",
    phrasings: ["willing to relocate", "open to relocation", "relocation", "relocate"],
  },
  {
    key: "links",
    tier: "A",
    phrasings: [
      "linkedin profile",
      "linkedin url",
      "github profile",
      "github url",
      "portfolio url",
      "personal website",
      "website url",
    ],
  },
  {
    key: "current-employer",
    tier: "A",
    phrasings: ["current employer", "current company", "most recent employer"],
  },
  {
    key: "years-of-experience",
    tier: "A",
    phrasings: [
      "total years of experience",
      "years of professional experience",
      "years of total experience",
    ],
  },
  {
    key: "languages",
    tier: "A",
    phrasings: [
      "languages you speak",
      "languages do you speak",
      "spoken languages",
      "language proficiency",
    ],
  },
  {
    key: "prior-employment-at-company",
    tier: "B",
    phrasings: [
      "previously worked here",
      "previously been employed",
      "former employee",
      "worked for us before",
      "prior employment",
    ],
  },
  {
    key: "non-compete",
    tier: "B",
    phrasings: ["non compete", "noncompete", "non competition", "restrictive covenant"],
  },
  {
    key: "how-heard",
    tier: "A",
    phrasings: [
      "how did you hear about",
      "how did you find out about",
      "where did you hear about",
      "how did you hear",
    ],
  },
  {
    key: "preferred-name",
    tier: "A",
    phrasings: ["preferred name", "preferred first name", "name you go by"],
  },
  {
    key: "gender",
    tier: "D",
    phrasings: ["gender", "gender identity", "what is your gender"],
  },
  {
    key: "race-ethnicity",
    tier: "D",
    phrasings: ["race", "ethnicity", "racial or ethnic", "race ethnicity"],
  },
  {
    key: "veteran",
    tier: "D",
    phrasings: ["veteran status", "protected veteran", "military service", "veteran"],
  },
  {
    key: "disability",
    tier: "D",
    phrasings: ["disability status", "disability", "disabled"],
  },
];

const NORMALIZED_PHRASINGS = ANSWER_KEYS.flatMap((entry) =>
  entry.phrasings.map((phrasing) => ({
    key: entry.key,
    phrase: ` ${normalizeQuestion(phrasing)} `,
  })),
);

/**
 * Resolves a form question to its Answer key by the longest phrasing it
 * contains. Returns null when nothing matches or two keys tie.
 */
export function resolveAnswerKey(question: string): AnswerKey | null {
  const haystack = ` ${normalizeQuestion(question)} `;
  const matches = NORMALIZED_PHRASINGS.filter(({ phrase }) => haystack.includes(phrase));
  if (matches.length === 0) return null;
  const longest = Math.max(...matches.map(({ phrase }) => phrase.length));
  const keys = new Set(
    matches.filter(({ phrase }) => phrase.length === longest).map(({ key }) => key),
  );
  const [only] = keys;
  return keys.size === 1 && only !== undefined ? only : null;
}

export function isTierDKey(key: AnswerKey): boolean {
  return ANSWER_KEYS.some((entry) => entry.key === key && entry.tier === "D");
}
