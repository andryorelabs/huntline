export type Fact = {
  readonly id: string;
  readonly text: string;
  readonly tags: readonly string[];
};

export type Profile = {
  readonly name: string;
  readonly contact: Readonly<Record<string, string>>;
};

export type Entry = {
  readonly id: string;
  readonly name: string;
  readonly role?: string;
  readonly dates?: string;
  readonly metadata: Readonly<Record<string, string>>;
};

export type SkillGroup = {
  readonly name: string;
  readonly items: readonly string[];
};

export type FactBank = {
  readonly facts: readonly Fact[];
  readonly profile?: Profile;
  readonly experience?: readonly Entry[];
  readonly projects?: readonly Entry[];
  readonly skills?: readonly SkillGroup[];
};

type VariantRule = {
  readonly all?: readonly string[];
  readonly any?: readonly string[];
  readonly none?: readonly string[];
};

export type Variant = VariantRule & { readonly name: string };

export type Bullet = {
  readonly id: string;
  readonly text: string;
  readonly tags: readonly string[];
  readonly factIds: readonly string[];
  readonly entry?: string;
  readonly order?: number;
};

type LintRule =
  | "never-claim"
  | "identity-leak"
  | "repeated-phrase"
  | "unbacked-number"
  | "placeholder";

export type LintFinding = {
  readonly rule: LintRule;
  readonly term: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
};

export type Coverage = {
  readonly covered: { requirement: string; factIds: string[] }[];
  readonly missing: string[];
};
