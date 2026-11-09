export type GuardDecision =
  | { readonly decision: "allow" }
  | { readonly decision: "deny"; readonly reason: string };

const SUBMIT_LABEL =
  /\b(submit|send|finali[sz]e|apply now|complete application|confirm application|post application)\b/i;
const SCRIPT_SUBMIT =
  /\.submit\s*\(|requestSubmit|\.click\s*\(|dispatchEvent|\bfetch\s*\(|XMLHttpRequest|sendBeacon/i;
const GMAIL_TOOL = /^mcp__.*gmail.*__(.+)$/i;
const CHROME_TOOL = /^mcp__.*chrome.*__(.+)$/i;
const GMAIL_SEND_ACTION = /send|reply|forward/i;
const ENTER_KEY = /\b(enter|return)\b/i;
const LABEL_KEYS: readonly string[] = [
  "label",
  "name",
  "text",
  "description",
  "title",
  "selector",
  "element",
  "ref",
  "role",
  "value",
];
const BENIGN_CHROME_ACTIONS: ReadonlySet<string> = new Set([
  "navigate_page",
  "new_page",
  "select_page",
  "list_pages",
  "close_page",
  "take_snapshot",
  "take_screenshot",
  "wait_for",
  "hover",
  "fill",
  "fill_form",
  "type_text",
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

function submitLikeLabel(toolInput: Record<string, unknown>): string | null {
  for (const key of LABEL_KEYS) {
    const value = stringField(toolInput, key);
    if (value !== null && SUBMIT_LABEL.test(value)) return value;
  }
  return null;
}

function decideChrome(action: string, toolInput: Record<string, unknown>): GuardDecision {
  const submitKey = toolInput["submitKey"];
  if (submitKey !== undefined && submitKey !== null && submitKey !== "") {
    return deny("typing with a submit key can submit a form; the human presses Submit");
  }
  if (action === "press_key") {
    const key = stringField(toolInput, "key");
    if (key === null) return deny("press_key without a readable key");
    return ENTER_KEY.test(key) ? deny("Enter can submit a form; the human presses Submit") : ALLOW;
  }
  if (action === "click") {
    const label = submitLikeLabel(toolInput);
    return label === null ? ALLOW : deny(`click on a submit-like control "${label}"`);
  }
  if (action === "evaluate_script") {
    const script = stringField(toolInput, "function") ?? stringField(toolInput, "script");
    if (script === null) return deny("evaluate_script without a readable script");
    return SCRIPT_SUBMIT.test(script) || SUBMIT_LABEL.test(script)
      ? deny("script could submit a form or send a request")
      : ALLOW;
  }
  if (BENIGN_CHROME_ACTIONS.has(action)) return ALLOW;
  return deny(`unknown browser action "${action}"`);
}

function decideUnchecked(input: unknown): GuardDecision {
  if (!isRecord(input)) return deny("hook payload is not a JSON object");
  const toolName = input["tool_name"];
  if (typeof toolName !== "string" || toolName === "") return deny("hook payload has no tool_name");
  const toolInput = input["tool_input"];
  const gmailAction = GMAIL_TOOL.exec(toolName)?.[1];
  if (gmailAction !== undefined) {
    return GMAIL_SEND_ACTION.test(gmailAction)
      ? deny(`Gmail ${gmailAction} is blocked; the human presses Send`)
      : ALLOW;
  }
  const chromeAction = CHROME_TOOL.exec(toolName)?.[1];
  if (chromeAction === undefined) return ALLOW;
  if (!isRecord(toolInput)) return deny("browser tool call has no readable tool_input");
  return decideChrome(chromeAction, toolInput);
}

export function decideGuard(input: unknown): GuardDecision {
  try {
    return decideUnchecked(input);
  } catch (error) {
    return deny(`guard error: ${error instanceof Error ? error.message : "unknown"}`);
  }
}
