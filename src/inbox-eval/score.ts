import { EMAIL_CLASSES } from "../inbox/types.ts";
import type { EmailClass } from "../core/types.ts";

export type LabelledEmail = {
  readonly messageId: string;
  readonly language: "en" | "es";
  readonly from: string;
  readonly subject: string;
  readonly body: string;
  readonly label: EmailClass;
};

export type Prediction = {
  readonly messageId: string;
  readonly classification: EmailClass;
};

export type ClassScore = {
  readonly support: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number | null;
  readonly recall: number | null;
};

export type EvalReport = {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly perClass: Readonly<Record<EmailClass, ClassScore>>;
  readonly missing: readonly string[];
  readonly unknown: readonly string[];
};

type Counts = {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  support: number;
};

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function toClassScore(counts: Counts): ClassScore {
  return {
    ...counts,
    precision: ratio(counts.truePositives, counts.truePositives + counts.falsePositives),
    recall: ratio(counts.truePositives, counts.truePositives + counts.falseNegatives),
  };
}

export function scoreClassifications(
  labels: readonly LabelledEmail[],
  predictions: readonly Prediction[],
): EvalReport {
  const predicted = new Map<string, EmailClass>();
  for (const prediction of predictions)
    predicted.set(prediction.messageId, prediction.classification);

  const counts = new Map<EmailClass, Counts>(
    EMAIL_CLASSES.map((name) => [
      name,
      { truePositives: 0, falsePositives: 0, falseNegatives: 0, support: 0 },
    ]),
  );
  const missing: string[] = [];
  let correct = 0;

  for (const email of labels) {
    const expected = counts.get(email.label);
    if (expected === undefined) continue;
    expected.support += 1;
    const actual = predicted.get(email.messageId);
    if (actual === undefined) {
      missing.push(email.messageId);
      expected.falseNegatives += 1;
    } else if (actual === email.label) {
      correct += 1;
      expected.truePositives += 1;
    } else {
      expected.falseNegatives += 1;
      const wrong = counts.get(actual);
      if (wrong !== undefined) wrong.falsePositives += 1;
    }
  }

  const known = new Set(labels.map((email) => email.messageId));
  const unknown = [...predicted.keys()].filter((messageId) => !known.has(messageId));
  const scoreFor = (name: EmailClass): ClassScore =>
    toClassScore(
      counts.get(name) ?? { truePositives: 0, falsePositives: 0, falseNegatives: 0, support: 0 },
    );
  const perClass: Record<EmailClass, ClassScore> = {
    rejection: scoreFor("rejection"),
    interview: scoreFor("interview"),
    "info-request": scoreFor("info-request"),
    offer: scoreFor("offer"),
    other: scoreFor("other"),
  };

  return {
    total: labels.length,
    correct,
    accuracy: labels.length === 0 ? 0 : correct / labels.length,
    perClass,
    missing,
    unknown,
  };
}
