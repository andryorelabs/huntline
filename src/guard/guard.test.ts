import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";

import { isObject } from "../core/narrow.ts";
import { formatHookOutput, guardDecisionFor, MAX_STDIN_BYTES } from "./command.ts";
import { decideGuard, snapshotScope, type LabelLookup } from "./decide.ts";
import { lookupLabel, parseSnapshotLabels, recordSnapshot } from "./snapshot.ts";

const CHROME = "mcp__chrome-devtools__";
const GMAIL = "mcp__claude_ai_Gmail__";

const LABELS: Readonly<Record<string, string>> = {
  "1_1": "Submit application",
  "1_2": "Next",
  "1_3": "Send",
};
const lookup: LabelLookup = (scope, uid) =>
  scope.endsWith("__chrome-devtools") ? (LABELS[uid] ?? null) : null;

function permissionDecisionOf(stdout: string): string {
  const parsed: unknown = JSON.parse(stdout);
  const output = isObject(parsed) ? parsed["hookSpecificOutput"] : undefined;
  const decision = isObject(output) ? output["permissionDecision"] : undefined;
  if (typeof decision !== "string") throw new Error("hook output has no permissionDecision");
  return decision;
}

function runGuard(stdin: string): { code: number; decision: string } {
  const result = Bun.spawnSync(["bun", "src/cli.ts", "guard"], {
    stdin: Buffer.from(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  return { code: result.exitCode, decision: permissionDecisionOf(result.stdout.toString()) };
}

function call(tool: string, toolInput: unknown): Record<string, unknown> {
  return {
    hook_event_name: "PreToolUse",
    session_id: "s1",
    tool_name: tool,
    tool_input: toolInput,
  };
}

function verdict(input: unknown): string {
  return decideGuard(input, lookup).decision;
}

describe("decideGuard", () => {
  test("denies a click on the Submit application uid and allows Next", () => {
    expect(verdict(call(`${CHROME}click`, { uid: "1_1" }))).toBe("deny");
    expect(verdict(call(`${CHROME}click`, { uid: "1_3" }))).toBe("deny");
    expect(verdict(call(`${CHROME}click`, { uid: "1_2" }))).toBe("allow");
  });

  test("denies a click on an unknown uid or without a session", () => {
    expect(verdict(call(`${CHROME}click`, { uid: "9_9" }))).toBe("deny");
    expect(verdict(call(`${CHROME}click`, {}))).toBe("deny");
    const noSession = { tool_name: `${CHROME}click`, tool_input: { uid: "1_2" } };
    expect(verdict(noSession)).toBe("deny");
  });

  test("denies every keyboard path that can submit", () => {
    for (const key of [
      "Enter",
      "NumpadEnter",
      "Return",
      "Space",
      " ",
      "Control+Enter",
      "Shift+ ",
      "\n",
      "\r",
      "Shift+\n",
    ]) {
      expect(verdict(call(`${CHROME}press_key`, { key }))).toBe("deny");
    }
    expect(verdict(call(`${CHROME}press_key`, { key: "Tab" }))).toBe("allow");
    expect(verdict(call(`${CHROME}type_text`, { text: "hi", submitKey: "Enter" }))).toBe("deny");
    expect(verdict(call(`${CHROME}type_text`, { text: "x\n" }))).toBe("deny");
    expect(verdict(call(`${CHROME}fill`, { uid: "1_2", value: "a\r\nb" }))).toBe("deny");
    expect(verdict(call(`${CHROME}fill_form`, { elements: [{ uid: "1_2", value: "x\n" }] }))).toBe(
      "deny",
    );
    expect(verdict(call(`${CHROME}type_text`, { text: " " }))).toBe("deny");
    expect(verdict(call(`${CHROME}type_text`, { text: "hello" }))).toBe("allow");
  });

  test("denies every script, including obfuscated submits", () => {
    const scripts = [
      "() => document.forms[0].submit()",
      "() => document.title",
      "() => el['cli'+'ck']()",
      "() => HTMLFormElement.prototype['sub'+'mit'].call(f)",
    ];
    for (const script of scripts) {
      expect(verdict(call(`${CHROME}evaluate_script`, { function: script }))).toBe("deny");
    }
  });

  test("guards browser tools from any server name by their action", () => {
    expect(verdict(call("mcp__cws-dash__click", { uid: "1_1" }))).toBe("deny");
    expect(verdict(call("mcp__Claude_Browser__press_key", { key: "Enter" }))).toBe("deny");
    expect(verdict(call("mcp__someserver__press_key", { key: "Enter" }))).toBe("deny");
    expect(verdict(call("mcp__someserver__list_things", {}))).toBe("allow");
  });

  test("denies Gmail send, reply and forward, allows drafts", () => {
    for (const action of ["send_message", "reply", "forward"]) {
      expect(verdict(call(`${GMAIL}${action}`, { body: "x" }))).toBe("deny");
    }
    expect(verdict(call(`${GMAIL}create_draft`, { body: "x" }))).toBe("allow");
  });

  test("denies malformed and unknown shapes", () => {
    const inputs: unknown[] = [
      null,
      undefined,
      42,
      "text",
      [],
      {},
      { tool_name: 5 },
      { tool_name: "" },
      call(`${CHROME}click`, null),
      call(`${CHROME}click`, "x"),
      call(`${CHROME}teleport`, {}),
      call(`${CHROME}press_key`, {}),
      call(`${CHROME}evaluate_script`, {}),
    ];
    for (const input of inputs) expect(verdict(input)).toBe("deny");
  });

  test("never throws on hostile objects", () => {
    const hostile = {
      get tool_name(): string {
        throw new Error("boom");
      },
    };
    expect(verdict(hostile)).toBe("deny");
  });

  test("allows benign navigation and unrelated tools", () => {
    expect(verdict(call(`${CHROME}navigate_page`, { url: "https://example.test" }))).toBe("allow");
    expect(verdict(call("Read", { file_path: "/x" }))).toBe("allow");
  });
});

describe("guardDecisionFor", () => {
  test("denies invalid JSON", async () => {
    expect((await guardDecisionFor(Readable.from(["{not json"]))).decision).toBe("deny");
  });

  test("denies empty input", async () => {
    expect((await guardDecisionFor(Readable.from([]))).decision).toBe("deny");
  });

  test("denies oversized input", async () => {
    const big = Buffer.alloc(MAX_STDIN_BYTES + 1, 97);
    expect((await guardDecisionFor(Readable.from([big]))).decision).toBe("deny");
  });

  test("denies when the stream errors", async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error("broken pipe"));
      },
    });
    expect((await guardDecisionFor(stream)).decision).toBe("deny");
  });

  test("allows a benign payload", async () => {
    const payload = JSON.stringify(call(`${CHROME}navigate_page`, { url: "https://example.test" }));
    expect((await guardDecisionFor(Readable.from([payload]))).decision).toBe("allow");
  });

  test("formats the hook output", () => {
    const output = formatHookOutput({ decision: "deny", reason: "r" });
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe("r");
  });
});

describe("huntline guard process", () => {
  test("prints exactly one deny object for invalid JSON", () => {
    const { code, decision } = runGuard("nope");
    expect(code).toBe(0);
    expect(decision).toBe("deny");
  });

  test("allows a navigation end to end and denies an unrecorded click", () => {
    const nav = runGuard(
      JSON.stringify(call(`${CHROME}navigate_page`, { url: "https://example.test" })),
    );
    expect(nav.decision).toBe("allow");
    const click = runGuard(JSON.stringify(call(`${CHROME}click`, { uid: "1_2" })));
    expect(click.decision).toBe("deny");
  });
});

describe("snapshot labels", () => {
  test("parses uid lines from text and nested content", () => {
    const response = {
      content: [
        { type: "text", text: 'uid=1_1 button "Submit application"\n  uid=1_2 button "Next"' },
      ],
    };
    expect(parseSnapshotLabels(response)).toEqual({
      "1_1": 'button "Submit application"',
      "1_2": 'button "Next"',
    });
  });

  test("records a snapshot and resolves a label by session", () => {
    const session = `test-${process.pid}-${Date.now()}`;
    const scope = snapshotScope(session, "chrome-devtools");
    recordSnapshot(
      scope,
      parseSnapshotLabels('uid=2_1 button "Submit application"\nuid=2_2 link "Next"'),
    );
    expect(lookupLabel(scope, "2_1")).toContain("Submit application");
    expect(lookupLabel(scope, "9_9")).toBeNull();
    expect(lookupLabel("other-session", "2_1")).toBeNull();
    const payload = { ...call(`${CHROME}click`, { uid: "2_1" }), session_id: session };
    expect(decideGuard(payload, lookupLabel).decision).toBe("deny");
    const otherServer = { ...call("mcp__user-chrome__click", { uid: "2_2" }), session_id: session };
    expect(decideGuard(otherServer, lookupLabel).decision).toBe("deny");
  });

  test("the recorder hook then the guard deny a submit click end to end", () => {
    const session = `e2e-${process.pid}-${Date.now()}`;
    const snapshot = {
      session_id: session,
      tool_name: `${CHROME}take_snapshot`,
      tool_response: 'uid=3_1 button "Submit application"\nuid=3_2 button "Next"',
    };
    const recorded = Bun.spawnSync(["bun", "src/cli.ts", "guard", "--record"], {
      stdin: Buffer.from(JSON.stringify(snapshot)),
      stdout: "pipe",
    });
    expect(recorded.exitCode).toBe(0);
    const ask = (uid: string): string => {
      const payload = { ...call(`${CHROME}click`, { uid }), session_id: session };
      const result = Bun.spawnSync(["bun", "src/cli.ts", "guard"], {
        stdin: Buffer.from(JSON.stringify(payload)),
        stdout: "pipe",
      });
      return permissionDecisionOf(result.stdout.toString());
    };
    expect(ask("3_1")).toBe("deny");
    expect(ask("3_2")).toBe("allow");
  });
});
