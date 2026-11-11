import type { IdempotencyMap } from "../core/approval.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import type { ApplicationState, Lead, Result, TitleFormat, TrackerAdapter } from "../core/types.ts";

export const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type LinearMapping = {
  readonly states: Readonly<Record<ApplicationState, string>>;
  readonly channelLabelPrefix: string;
  readonly channelLabels?: Readonly<Record<string, string>>;
};

export const DEFAULT_LINEAR_MAPPING: LinearMapping = {
  states: {
    lead: "Backlog",
    "to-apply": "Todo",
    applied: "In Progress",
    screening: "In Progress",
    interviewing: "In Progress",
    offer: "In Progress",
    hired: "Done",
    rejected: "Canceled",
    withdrawn: "Canceled",
    discarded: "Canceled",
  },
  channelLabelPrefix: "channel:",
};

export type LinearOptions = {
  readonly apiKey: string | undefined;
  readonly team: string | undefined;
  readonly idempotency: IdempotencyMap;
  readonly fetch?: FetchLike;
  readonly mapping?: LinearMapping;
  readonly titleFormat?: TitleFormat;
};

type Named = { readonly id: string; readonly name: string };

type TeamMetadata = {
  readonly id: string;
  readonly states: readonly Named[];
  readonly labels: readonly Named[];
};

const TEAM_QUERY = `query Team($key: String!) {
  teams(filter: { key: { eq: $key } }) {
    nodes { id key states { nodes { id name } } labels { nodes { id name } } }
  }
}`;

const FIND_QUERY = `query FindIssue($teamId: ID!, $marker: String!) {
  issues(filter: { team: { id: { eq: $teamId } }, description: { contains: $marker } }, first: 1) {
    nodes { id }
  }
}`;

const CREATE_LABEL_MUTATION = `mutation CreateLabel($teamId: String!, $name: String!) {
  issueLabelCreate(input: { teamId: $teamId, name: $name }) { success issueLabel { id name } }
}`;

const CREATE_ISSUE_MUTATION = `mutation CreateIssue($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { id identifier } }
}`;

const UPDATE_ISSUE_MUTATION = `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) { success }
}`;

const COMMENT_MUTATION = `mutation Comment($input: CommentCreateInput!) {
  commentCreate(input: $input) { success }
}`;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function readNamed(value: unknown): Named[] {
  if (!isObject(value) || !Array.isArray(value["nodes"])) return [];
  const named: Named[] = [];
  for (const node of value["nodes"]) {
    if (isObject(node) && typeof node["id"] === "string" && typeof node["name"] === "string") {
      named.push({ id: node["id"], name: node["name"] });
    }
  }
  return named;
}

function pathValue(root: unknown, segments: readonly string[]): unknown {
  let cursor: unknown = root;
  for (const segment of segments) {
    if (!isObject(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function sameName(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** The issue key marker is persisted in Linear descriptions, so it keeps its pre-rename spelling (ADR-0005). */
function marker(key: string): string {
  return `[huntline-key: ${key}]`;
}

export function createLinearTracker(options: LinearOptions): TrackerAdapter {
  const send: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const mapping = options.mapping ?? DEFAULT_LINEAR_MAPPING;
  let metadata: TeamMetadata | null = null;

  async function graphql(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<Result<unknown>> {
    if (options.apiKey === undefined || options.apiKey === "") {
      return fail("tracker-linear-no-key", "LINEAR_API_KEY is not set");
    }
    let response: Response;
    try {
      response = await send(LINEAR_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: options.apiKey },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      return fail(
        "tracker-linear-network",
        errorMessage(error).split(options.apiKey).join("[redacted]"),
      );
    }
    if (!response.ok) {
      return fail("tracker-linear-http", `Linear responded with HTTP ${response.status}`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      return fail("tracker-linear-malformed", errorMessage(error));
    }
    if (!isObject(body)) return fail("tracker-linear-malformed", "response is not an object");
    const errors = body["errors"];
    if (Array.isArray(errors) && errors.length > 0) {
      const first: unknown = errors[0];
      const message =
        isObject(first) && typeof first["message"] === "string"
          ? first["message"]
          : "unknown error";
      return fail("tracker-linear-graphql", message);
    }
    return { ok: true, value: body["data"] };
  }

  async function loadTeam(): Promise<Result<TeamMetadata>> {
    if (metadata !== null) return { ok: true, value: metadata };
    if (options.team === undefined || options.team === "") {
      return fail("tracker-linear-no-team", "tracker.team is required for the linear tracker");
    }
    const result = await graphql(TEAM_QUERY, { key: options.team });
    if (!result.ok) return result;
    const nodes = pathValue(result.value, ["teams", "nodes"]);
    const team: unknown = Array.isArray(nodes) ? nodes[0] : undefined;
    if (!isObject(team) || typeof team["id"] !== "string") {
      return fail("tracker-linear-no-team", `Linear team ${options.team} was not found`);
    }
    metadata = {
      id: team["id"],
      states: readNamed(team["states"]),
      labels: readNamed(team["labels"]),
    };
    return { ok: true, value: metadata };
  }

  function stateId(team: TeamMetadata, state: ApplicationState): Promise<Result<string>> {
    const wanted = mapping.states[state];
    const match = team.states.find((candidate) => sameName(candidate.name, wanted));
    return Promise.resolve(
      match === undefined
        ? fail("tracker-linear-no-state", `Linear state "${wanted}" for ${state} does not exist`)
        : { ok: true, value: match.id },
    );
  }

  async function labelId(team: TeamMetadata, name: string): Promise<Result<string>> {
    const existing = team.labels.find((candidate) => sameName(candidate.name, name));
    if (existing !== undefined) return { ok: true, value: existing.id };
    const created = await graphql(CREATE_LABEL_MUTATION, { teamId: team.id, name });
    if (!created.ok) return created;
    const id = pathValue(created.value, ["issueLabelCreate", "issueLabel", "id"]);
    if (typeof id !== "string")
      return fail("tracker-linear-malformed", "label creation returned no id");
    metadata = { ...team, labels: [...team.labels, { id, name }] };
    return { ok: true, value: id };
  }

  function channelLabelName(source: string): string {
    return mapping.channelLabels?.[source] ?? `${mapping.channelLabelPrefix}${source}`;
  }

  function issueTitle(lead: Lead): string {
    return options.titleFormat === "company-role"
      ? `${lead.posting.company} - ${lead.posting.title}`
      : `${lead.posting.title} at ${lead.posting.company}`;
  }

  function mapKey(key: string): string {
    return `linear:${options.team ?? ""}:${key}`;
  }

  async function findIssue(key: string): Promise<Result<string | null>> {
    const recorded = options.idempotency.lookup(mapKey(key));
    if (recorded !== null) return { ok: true, value: recorded };
    const team = await loadTeam();
    if (!team.ok) return team;
    const found = await graphql(FIND_QUERY, { teamId: team.value.id, marker: marker(key) });
    if (!found.ok) return found;
    const nodes = pathValue(found.value, ["issues", "nodes"]);
    const first: unknown = Array.isArray(nodes) ? nodes[0] : undefined;
    if (!isObject(first) || typeof first["id"] !== "string") return { ok: true, value: null };
    options.idempotency.record(mapKey(key), first["id"]);
    return { ok: true, value: first["id"] };
  }

  async function createIssue(lead: Lead): Promise<Result<string>> {
    const team = await loadTeam();
    if (!team.ok) return team;
    const state = await stateId(team.value, "lead");
    if (!state.ok) return state;
    const label = await labelId(team.value, channelLabelName(lead.posting.source));
    if (!label.ok) return label;
    const description = [
      lead.posting.url,
      "",
      `source: ${lead.posting.source}`,
      `eligibility: ${lead.eligibility}`,
      marker(lead.key),
    ].join("\n");
    const created = await graphql(CREATE_ISSUE_MUTATION, {
      input: {
        teamId: team.value.id,
        title: issueTitle(lead),
        description,
        stateId: state.value,
        labelIds: [label.value],
      },
    });
    if (!created.ok) return created;
    const id = pathValue(created.value, ["issueCreate", "issue", "id"]);
    if (typeof id !== "string")
      return fail("tracker-linear-malformed", "issue creation returned no id");
    options.idempotency.record(mapKey(lead.key), id);
    return { ok: true, value: id };
  }

  async function issueFor(key: string): Promise<Result<string>> {
    const found = await findIssue(key);
    if (!found.ok) return found;
    return found.value === null
      ? fail("tracker-not-found", `no Linear issue for ${key}`)
      : { ok: true, value: found.value };
  }

  async function mutate(query: string, variables: Record<string, unknown>): Promise<Result<void>> {
    const result = await graphql(query, variables);
    return result.ok ? { ok: true, value: undefined } : result;
  }

  return {
    async upsertLead(lead: Lead): Promise<Result<string>> {
      const found = await findIssue(lead.key);
      if (!found.ok) return found;
      return found.value === null ? createIssue(lead) : { ok: true, value: found.value };
    },
    async setStatus(key: string, state: ApplicationState): Promise<Result<void>> {
      const issue = await issueFor(key);
      if (!issue.ok) return issue;
      const team = await loadTeam();
      if (!team.ok) return team;
      const target = await stateId(team.value, state);
      if (!target.ok) return target;
      return mutate(UPDATE_ISSUE_MUTATION, { id: issue.value, input: { stateId: target.value } });
    },
    async comment(key: string, text: string): Promise<Result<void>> {
      const issue = await issueFor(key);
      if (!issue.ok) return issue;
      return mutate(COMMENT_MUTATION, { input: { issueId: issue.value, body: text } });
    },
    find: findIssue,
  };
}
