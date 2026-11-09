export type GuardDecision =
  | { readonly decision: "allow" }
  | { readonly decision: "deny"; readonly reason: string };

export type LabelLookup = (sessionId: string, uid: string) => string | null;

const SUBMIT_LABEL =
  /\b(submit|send|finali[sz]e|apply now|complete application|confirm application|post application)\b/i;
const MCP_TOOL = /^mcp__(.+?)__(.+)$/;
const BROWSER_SERVER = /chrome|browser|devtools|playwright|puppeteer|cdp|dash/i;
const GMAIL_SERVER = /gmail/i;
const GMAIL_SEND_ACTION = /send|reply|forward/i;
const KEY_THAT_SUBMITS = /enter|return|space/i;
const LINE_BREAK = /[\r\n]/;
const INTERACTIVE_ACTIONS: ReadonlySet<string> = new Set([
  "click",
  "press_key",
  "type_text",
  "fill",
  "fill_form",
  "evaluate_script",
  "drag",
  "upload_file",
  "handle_dialog",
  "hover",
]);
const BENIGN_BROWSER_ACTIONS: ReadonlySet<string> = new Set([
  "navigate_page",
  "new_page",
  "select_page",
  "list_pages",
  "close_page",
  "take_snapshot",
  "take_screenshot",
  "wait_for",
  "hover",
  "upload_file",
  "resize_page",
  "emulate",
  "list_console_messages",
  "get_console_message",
  "list_network_requests",
  "get_network_request",
  "handle_dialog",
]);

const ALLOW: GuardDecision = { decision: "allow" };

function deny(reason: string): GuardDecision {
  return { decision: "deny", reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function containsLineBreak(value: unknown, depth = 0): boolean {
  if (depth > 6) return true;
  if (typeof value === "string") return LINE_BREAK.test(value);
  if (Array.isArray(value)) return value.some((entry) => containsLineBreak(entry, depth + 1));
  if (isRecord(value)) return Object.values(value).some((entry) => containsLineBreak(entry, depth + 1));
  return false;
}

function decideKey(toolInput: Record<string, unknown>): GuardDecision {
  const key = stringField(toolInput, "key");
  if (key === null) return deny("press_key without a readable key");
  const parts = key.split("+");
  const submits = parts.some((part) => part === " " || KEY_THAT_SUBMITS.test(part));
  return submits ? deny("Enter or Space can submit a form; the human presses Submit") : ALLOW;
}

function decideClick(
  toolInput: Record<string, unknown>,
  sessionId: string | null,
  lookup: LabelLookup,
): GuardDecision {
  const uid = stringField(toolInput, "uid");
  if (uid === null || uid === "") return deny("click without a readable uid");
  if (sessionId === null) return deny("click cannot be checked without a session id");
  const label = lookup(sessionId, uid);
  if (label === null) {
    return deny(`click on uid ${uid} has no known label; take a fresh snapshot first`);
  }
  return SUBMIT_LABEL.test(label) ? deny(`click on a submit-like control "${label}"`) : ALLOW;
}

function decideBrowser(
  action: string,
  toolInput: Record<string, unknown>,
  sessionId: string | null,
  lookup: LabelLookup,
): GuardDecision {
  const submitKey = toolInput["submitKey"];
  if (submitKey !== undefined && submitKey !== null && submitKey !== "") {
    return deny("typing with a submit key can submit a form; the human presses Submit");
  }
  if (action === "press_key") return decideKey(toolInput);
  if (action === "click") return decideClick(toolInput, sessionId, lookup);
  if (action === "evaluate_script") {
    return deny("evaluate_script is blocked: scripts can submit or send; use snapshots to read the page");
  }
  if (action === "type_text" || action === "fill" || action === "fill_form") {
    return containsLineBreak(toolInput)
      ? deny("a line break in typed or filled text can submit a form")
      : ALLOW;
  }
  if (action === "drag") return deny("drag is blocked");
  return BENIGN_BROWSER_ACTIONS.has(action) ? ALLOW : deny(`unknown browser action "${action}"`);
}

function decideUnchecked(input: unknown, lookup: LabelLookup): GuardDecision {
  if (!isRecord(input)) return deny("hook payload is not a JSON object");
  const toolName = input["tool_name"];
  if (typeof toolName !== "string" || toolName === "") return deny("hook payload has no tool_name");
  const match = MCP_TOOL.exec(toolName);
  if (match === null) return ALLOW;
  const server = match[1] ?? "";
  const action = match[2] ?? "";
  if (GMAIL_SERVER.test(server)) {
    return GMAIL_SEND_ACTION.test(action)
      ? deny(`Gmail ${action} is blocked; the human presses Send`)
      : ALLOW;
  }
  if (!BROWSER_SERVER.test(server) && !INTERACTIVE_ACTIONS.has(action)) return ALLOW;
  const toolInput = input["tool_input"];
  if (!isRecord(toolInput)) return deny("browser tool call has no readable tool_input");
  const sessionId = typeof input["session_id"] === "string" && input["session_id"] !== "" ? input["session_id"] : null;
  return decideBrowser(action, toolInput, sessionId, lookup);
}

export function decideGuard(input: unknown, lookup: LabelLookup = () => null): GuardDecision {
  try {
    return decideUnchecked(input, lookup);
  } catch (error) {
    return deny(`guard error: ${error instanceof Error ? error.message : "unknown"}`);
  }
}
