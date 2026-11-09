export type Fact = {
  readonly id: string;
  readonly text: string;
  readonly tags: readonly string[];
};

export type FactBank = {
  readonly facts: readonly Fact[];
};

export type Bullet = {
  readonly id: string;
  readonly text: string;
  readonly tags: readonly string[];
  readonly factIds: readonly string[];
};

export type LintRule = "never-claim" | "repeated-phrase" | "unbacked-number" | "placeholder";

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
