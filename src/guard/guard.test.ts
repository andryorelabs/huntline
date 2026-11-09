import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";

import { formatHookOutput, guardDecisionFor, MAX_STDIN_BYTES } from "./command.ts";
import { decideGuard } from "./decide.ts";

const CHROME = "mcp__chrome-devtools__";
const GMAIL = "mcp__claude_ai_Gmail__";

function call(tool: string, toolInput: unknown): unknown {
  return { hook_event_name: "PreToolUse", tool_name: tool, tool_input: toolInput };
}

function verdict(input: unknown): string {
  return decideGuard(input).decision;
}

describe("decideGuard", () => {
  test("denies a click on Submit application", () => {
    expect(verdict(call(`${CHROME}click`, { uid: "1_2", name: "Submit application" }))).toBe("deny");
  });

  test("allows a click on Next", () => {
    expect(verdict(call(`${CHROME}click`, { uid: "1_2", name: "Next" }))).toBe("allow");
  });

  test("denies Enter key presses and submitKey typing", () => {
    expect(verdict(call(`${CHROME}press_key`, { key: "Enter" }))).toBe("deny");
    expect(verdict(call(`${CHROME}press_key`, { key: "Tab" }))).toBe("allow");
    expect(verdict(call(`${CHROME}type_text`, { text: "hi", submitKey: "Enter" }))).toBe("deny");
  });

  test("denies scripts that could submit, allows reads", () => {
    const submitting = { function: "() => document.forms[0].submit()" };
    expect(verdict(call(`${CHROME}evaluate_script`, submitting))).toBe("deny");
    expect(verdict(call(`${CHROME}evaluate_script`, { function: "() => document.title" }))).toBe(
      "allow",
    );
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
    const payload = JSON.stringify(call(`${CHROME}click`, { name: "Next" }));
    expect((await guardDecisionFor(Readable.from([payload]))).decision).toBe("allow");
  });

  test("formats the hook output", () => {
    const output = formatHookOutput({ decision: "deny", reason: "r" });
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe("r");
  });
});

describe("huntline guard process", () => {
  type Parsed = { hookSpecificOutput: { permissionDecision: string } };

  function runGuard(stdin: string): { code: number; parsed: Parsed } {
    const result = Bun.spawnSync(["bun", "src/cli.ts", "guard"], {
      stdin: Buffer.from(stdin),
      stdout: "pipe",
      stderr: "pipe",
    });
    return { code: result.exitCode, parsed: JSON.parse(result.stdout.toString()) as Parsed };
  }

  test("prints exactly one deny object for invalid JSON", () => {
    const { code, parsed } = runGuard("nope");
    expect(code).toBe(0);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  test("allows a Next click end to end", () => {
    const { parsed } = runGuard(JSON.stringify(call(`${CHROME}click`, { name: "Next" })));
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
  });
});
