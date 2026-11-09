import hooksJson from "../../hooks/hooks.json" with { type: "json" };
import { isObject } from "../core/narrow.ts";
import { decideGuard, snapshotScope, type GuardDecision, type LabelLookup } from "./decide.ts";

export const SELF_TEST_HOOKS: unknown = hooksJson;

export type SelfTestCase = {
  readonly name: string;
  readonly tool: string;
  readonly expected: "allow" | "deny";
  readonly actual: "allow" | "deny";
  readonly matcherCovers: boolean;
  readonly pass: boolean;
};

export type SelfTestResult = { readonly pass: boolean; readonly cases: SelfTestCase[] };

type Decide = (input: unknown, lookup?: LabelLookup) => GuardDecision;

type CannedCase = {
  readonly name: string;
  readonly tool: string;
  readonly toolInput: Record<string, unknown>;
  readonly expected: "allow" | "deny";
};

const SESSION_ID = "self-test";
const SUBMIT_UID = "1_1";

const CANNED_CASES: readonly CannedCase[] = [
  {
    name: "user-chrome click on Submit application",
    tool: "mcp__user-chrome__click",
    toolInput: { uid: SUBMIT_UID },
    expected: "deny",
  },
  {
    name: "chrome-devtools click on Submit application",
    tool: "mcp__chrome-devtools__click",
    toolInput: { uid: SUBMIT_UID },
    expected: "deny",
  },
  {
    name: "press_key Enter",
    tool: "mcp__chrome-devtools__press_key",
    toolInput: { key: "Enter" },
    expected: "deny",
  },
  {
    name: "evaluate_script",
    tool: "mcp__chrome-devtools__evaluate_script",
    toolInput: { function: "() => document.forms[0].submit()" },
    expected: "deny",
  },
  {
    name: "Gmail send_message",
    tool: "mcp__claude_ai_Gmail__send_message",
    toolInput: { to: "recruiter@acme.example", body: "hello" },
    expected: "deny",
  },
  {
    name: "take_snapshot",
    tool: "mcp__chrome-devtools__take_snapshot",
    toolInput: {},
    expected: "allow",
  },
];

function submitLabelLookup(scope: string, uid: string): string | null {
  const known = [
    snapshotScope(SESSION_ID, "user-chrome"),
    snapshotScope(SESSION_ID, "chrome-devtools"),
  ];
  return known.includes(scope) && uid === SUBMIT_UID ? "Submit application" : null;
}

function preToolUseMatchers(hooks: unknown): string[] {
  if (!isObject(hooks) || !isObject(hooks["hooks"])) return [];
  const entries = hooks["hooks"]["PreToolUse"];
  if (!Array.isArray(entries)) return [];
  const matchers: string[] = [];
  for (const entry of entries as unknown[]) {
    if (isObject(entry) && typeof entry["matcher"] === "string") matchers.push(entry["matcher"]);
  }
  return matchers;
}

function matcherCovers(matchers: readonly string[], tool: string): boolean {
  return matchers.some((matcher) => {
    try {
      return new RegExp(`^(?:${matcher})$`).test(tool);
    } catch {
      return false;
    }
  });
}

export function runGuardSelfTest(hooks: unknown, decide: Decide = decideGuard): SelfTestResult {
  const matchers = preToolUseMatchers(hooks);
  const cases = CANNED_CASES.map((canned): SelfTestCase => {
    const payload = {
      hook_event_name: "PreToolUse",
      session_id: SESSION_ID,
      tool_name: canned.tool,
      tool_input: canned.toolInput,
    };
    const actual = decide(payload, submitLabelLookup).decision;
    const covers = matcherCovers(matchers, canned.tool);
    const matcherOk = canned.expected === "allow" || covers;
    return {
      name: canned.name,
      tool: canned.tool,
      expected: canned.expected,
      actual,
      matcherCovers: covers,
      pass: actual === canned.expected && matcherOk,
    };
  });
  return { pass: cases.every((entry) => entry.pass), cases };
}
