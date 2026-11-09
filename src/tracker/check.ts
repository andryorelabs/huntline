import { errorMessage, isObject } from "../core/narrow.ts";
import { type FetchLike, LINEAR_ENDPOINT, type LinearMapping } from "./linear.ts";

export type LinearCheckResult =
  | { readonly ok: true; readonly value: { readonly teamId: string } }
  | { readonly ok: false; readonly error: { readonly problems: string[] } };

export type LinearCheckOptions = {
  readonly apiKey: string | undefined;
  readonly team: string | undefined;
  readonly mapping: LinearMapping;
  readonly fetch?: FetchLike;
};

const CHECK_QUERY = `query TeamCheck($key: String!) {
  teams(filter: { key: { eq: $key } }) {
    nodes { id key states { nodes { id name } } }
  }
}`;

function stateNames(team: Record<string, unknown>): string[] {
  const states = team["states"];
  if (!isObject(states) || !Array.isArray(states["nodes"])) return [];
  const names: string[] = [];
  for (const node of states["nodes"]) {
    if (isObject(node) && typeof node["name"] === "string") names.push(node["name"]);
  }
  return names;
}

function failure(problems: string[]): LinearCheckResult {
  return { ok: false, error: { problems } };
}

export async function checkLinearConnection(options: LinearCheckOptions): Promise<LinearCheckResult> {
  const { apiKey, team, mapping } = options;
  const problems: string[] = [];
  const hasKey = apiKey !== undefined && apiKey !== "";
  const hasTeam = team !== undefined && team !== "";
  if (!hasKey) problems.push("LINEAR_API_KEY is not set");
  if (!hasTeam) problems.push("tracker.team is not set");
  if (!hasKey || !hasTeam) return failure(problems);

  const send: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const redact = (text: string): string => text.split(apiKey).join("[redacted]");

  let response: Response;
  try {
    response = await send(LINEAR_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: apiKey },
      body: JSON.stringify({ query: CHECK_QUERY, variables: { key: team } }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    return failure([`could not reach Linear: ${redact(errorMessage(error))}`]);
  }

  if (response.status === 401 || response.status === 403) {
    return failure([`Linear rejected LINEAR_API_KEY (HTTP ${response.status})`]);
  }
  if (!response.ok) {
    return failure([`Linear responded with HTTP ${response.status}`]);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return failure([`Linear returned a malformed response: ${redact(errorMessage(error))}`]);
  }
  if (!isObject(body)) return failure(["Linear returned a malformed response"]);

  const errors = body["errors"];
  if (Array.isArray(errors) && errors.length > 0) {
    const first: unknown = errors[0];
    const message = isObject(first) && typeof first["message"] === "string" ? first["message"] : "unknown error";
    return failure([`Linear rejected the request: ${redact(message)}`]);
  }

  const data = body["data"];
  const teams = isObject(data) && isObject(data["teams"]) ? data["teams"] : undefined;
  const nodes: unknown = teams === undefined ? undefined : teams["nodes"];
  const found: unknown = Array.isArray(nodes) ? nodes[0] : undefined;
  if (!isObject(found) || typeof found["id"] !== "string") {
    return failure([`team ${team} not found`]);
  }

  const available = new Set(stateNames(found).map((name) => name.toLowerCase()));
  for (const name of new Set(Object.values(mapping.states))) {
    if (!available.has(name.toLowerCase())) problems.push(`state "${name}" not found in team ${team}`);
  }
  if (problems.length > 0) return failure(problems);
  return { ok: true, value: { teamId: found["id"] } };
}
