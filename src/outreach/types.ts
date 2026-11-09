export const CHANNELS = ["linkedin", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export type Draft = {
  readonly channel: Channel;
  readonly body: string;
  readonly addressee?: string;
  readonly company?: string;
};

export type Recipient = {
  readonly name: string;
};

export type OutreachEntry = {
  readonly channel: Channel;
  readonly recipient: string;
  readonly key?: string;
};

export type LintRule =
  | "too-long"
  | "empty"
  | "placeholder"
  | "stock-phrase"
  | "wrong-name"
  | "wrong-company";

export type LintFinding = {
  readonly rule: LintRule;
  readonly message: string;
};
