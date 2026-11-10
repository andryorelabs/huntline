export type AnswerScope = string;

export type AnswerResult =
  | { readonly status: "answer"; readonly text: string; readonly provenance: string }
  | { readonly status: "abstain" };

export type IntendedField = {
  readonly name: string;
  readonly kind: "text" | "file";
  readonly value: string;
};

export type FieldDump = {
  readonly name: string;
  readonly value: string;
};

type VerifyFindingClass = "missing" | "value-mismatch" | "file-name-mismatch";

export type VerifyFinding = {
  readonly field: string;
  readonly class: VerifyFindingClass;
  readonly expected: string;
  readonly actual: string | null;
};

export type NeedsItem = {
  readonly blockerId: string;
  readonly detail: string;
  readonly at: string;
};

export type NeedsGroup = {
  readonly key: string;
  readonly scope: "field" | "section" | "application";
  readonly items: readonly NeedsItem[];
};
