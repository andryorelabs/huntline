import hooksJson from "../../hooks/hooks.json" with { type: "json" };
import { isObject } from "../core/narrow.ts";
import { decideGuard, snapshotScope, type GuardDecision, type LabelLookup } from "./decide.ts";

export const SELF_TEST_HOOKS: unknown = hooksJson;

type SelfTestCase = {
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
  readonly matcherMustMiss?: true;
};

const SESSION_ID = "self-test";
const LABELLED_SERVERS: readonly string[] = [
  "user-chrome",
  "chrome-devtools",
  "remote-devices__Claude_Browser",
];
const LABELS: Readonly<Record<string, string>> = {
  "1_1": 'button "Submit application"',
  "1_2": 'button "Apply"',
  "1_3": 'button "Connect"',
  "1_4": 'button "Confirm"',
  "1_5": 'button "Post"',
  "1_6": 'button "Send invitation"',
  "1_7": 'button "Next"',
};

function clickCase(name: string, uid: string, expected: "allow" | "deny"): CannedCase {
  return { name, tool: "mcp__chrome-devtools__click", toolInput: { uid }, expected };
}

const CANNED_CASES: readonly CannedCase[] = [
  {
    name: "user-chrome click on Submit application",
    tool: "mcp__user-chrome__click",
    toolInput: { uid: "1_1" },
    expected: "deny",
  },
  clickCase("chrome-devtools click on Submit application", "1_1", "deny"),
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
    name: "Gmail send_email on a lowercase server",
    tool: "mcp__gmail__send_email",
    toolInput: { to: "recruiter@globex.example", body: "hello" },
    expected: "deny",
  },
  {
    name: "Gmail send_draft on a mixed-case server",
    tool: "mcp__Gmail__send_draft",
    toolInput: { draftId: "d1" },
    expected: "deny",
  },
  {
    name: "nested Claude_Browser click on Apply",
    tool: "mcp__remote-devices__Claude_Browser__click",
    toolInput: { uid: "1_2" },
    expected: "deny",
  },
  {
    name: "dash is not a browser server",
    tool: "mcp__x__delete_dashboard",
    toolInput: {},
    expected: "allow",
    matcherMustMiss: true,
  },
  clickCase("click on Connect", "1_3", "deny"),
  clickCase("click on Confirm", "1_4", "deny"),
  clickCase("click on Post", "1_5", "deny"),
  clickCase("click on Send invitation", "1_6", "deny"),
  clickCase("click on Next", "1_7", "allow"),
  {
    name: "handle_dialog accept",
    tool: "mcp__chrome-devtools__handle_dialog",
    toolInput: { action: "accept" },
    expected: "deny",
  },
  {
    name: "handle_dialog dismiss",
    tool: "mcp__chrome-devtools__handle_dialog",
    toolInput: { action: "dismiss" },
    expected: "allow",
  },
  {
    name: "take_snapshot",
    tool: "mcp__chrome-devtools__take_snapshot",
    toolInput: {},
    expected: "allow",
  },
];

function cannedLabelLookup(scope: string, uid: string): string | null {
  const known = LABELLED_SERVERS.map((server) => snapshotScope(SESSION_ID, server));
  return known.includes(scope) ? (LABELS[uid] ?? null) : null;
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
    const actual = decide(payload, cannedLabelLookup).decision;
    const covers = matcherCovers(matchers, canned.tool);
    const matcherOk =
      canned.matcherMustMiss === true ? !covers : canned.expected === "allow" || covers;
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
