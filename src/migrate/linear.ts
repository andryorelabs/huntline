import type { CommandContext } from "../core/commands.ts";
import { errorMessage, isObject } from "../core/narrow.ts";
import type { Posting, Result } from "../core/types.ts";
import { LINEAR_ENDPOINT, type FetchLike } from "../tracker/linear.ts";
import { withImporter, type Importer } from "./importer.ts";
import { mapState } from "./states.ts";
import { splitCompanyRole } from "./title.ts";
import type { ImportResult } from "./types.ts";

const PAGE_SIZE = 100;
const KEY_MARKER = /\[huntline-key: ([^\]]+)\]/;

const ISSUES_QUERY = `query Issues($filter: IssueFilter!, $after: String) {
  issues(filter: $filter, first: ${PAGE_SIZE}, after: $after) {
    nodes { id identifier title description url createdAt state { name } labels { nodes { name } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

export type LinearImportOptions = {
  readonly team: string;
  readonly project?: string;
  readonly fetch?: FetchLike;
};

type LinearIssue = {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly createdAt: string;
  readonly stateName: string;
  readonly labels: readonly string[];
};

type Page = { readonly issues: LinearIssue[]; readonly next: string | null };

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function labelNames(value: unknown): string[] {
  if (!isObject(value) || !Array.isArray(value["nodes"])) return [];
  const names: string[] = [];
  for (const label of value["nodes"] as unknown[]) {
    if (isObject(label) && typeof label["name"] === "string") names.push(label["name"]);
  }
  return names;
}

function toIssue(node: unknown): LinearIssue | null {
  if (!isObject(node) || typeof node["id"] !== "string" || typeof node["title"] !== "string") return null;
  const state = node["state"];
  return {
    id: node["id"],
    identifier: text(node["identifier"]),
    title: node["title"],
    description: text(node["description"]),
    url: text(node["url"]),
    createdAt: text(node["createdAt"]),
    stateName: isObject(state) ? text(state["name"]) : "",
    labels: labelNames(node["labels"]),
  };
}

async function fetchPage(
  send: FetchLike,
  apiKey: string,
  filter: Record<string, unknown>,
  after: string | null,
): Promise<Result<Page>> {
  let response: Response;
  try {
    response = await send(LINEAR_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: apiKey },
      body: JSON.stringify({ query: ISSUES_QUERY, variables: { filter, after } }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    return fail("migrate-linear-network", errorMessage(error).split(apiKey).join("[redacted]"));
  }
  if (!response.ok) return fail("migrate-linear-http", `Linear responded with HTTP ${response.status}`);
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return fail("migrate-linear-malformed", errorMessage(error));
  }
  if (!isObject(body)) return fail("migrate-linear-malformed", "response is not an object");
  if (Array.isArray(body["errors"]) && body["errors"].length > 0) {
    const first: unknown = body["errors"][0];
    return fail("migrate-linear-graphql", isObject(first) ? text(first["message"]) : "unknown error");
  }
  const data = body["data"];
  const issues = isObject(data) ? data["issues"] : undefined;
  if (!isObject(issues) || !Array.isArray(issues["nodes"])) {
    return fail("migrate-linear-malformed", "response has no issues");
  }
  const parsed = (issues["nodes"] as unknown[])
    .map(toIssue)
    .filter((issue): issue is LinearIssue => issue !== null);
  const pageInfo = issues["pageInfo"];
  const next =
    isObject(pageInfo) && pageInfo["hasNextPage"] === true && typeof pageInfo["endCursor"] === "string"
      ? pageInfo["endCursor"]
      : null;
  return { ok: true, value: { issues: parsed, next } };
}

async function fetchFrom(
  send: FetchLike,
  apiKey: string,
  filter: Record<string, unknown>,
  after: string | null,
  collected: readonly LinearIssue[],
): Promise<Result<LinearIssue[]>> {
  const page = await fetchPage(send, apiKey, filter, after);
  if (!page.ok) return page;
  const all = [...collected, ...page.value.issues];
  if (page.value.next === null) return { ok: true, value: all };
  return fetchFrom(send, apiKey, filter, page.value.next, all);
}

function fetchAll(
  send: FetchLike,
  apiKey: string,
  options: LinearImportOptions,
): Promise<Result<LinearIssue[]>> {
  const filter: Record<string, unknown> = { team: { key: { eq: options.team } } };
  if (options.project !== undefined) filter["project"] = { name: { eq: options.project } };
  return fetchFrom(send, apiKey, filter, null, []);
}

export function splitTitle(title: string): { role: string; company: string } {
  const atIndex = title.lastIndexOf(" at ");
  if (atIndex === -1 && title.includes(" - ")) return splitCompanyRole(title);
  if (atIndex === -1) return { role: title.trim(), company: "" };
  return { role: title.slice(0, atIndex).trim(), company: title.slice(atIndex + 4).trim() };
}

function toPosting(issue: LinearIssue): Posting {
  const { role, company } = splitTitle(issue.title);
  const channelLabel = issue.labels.find((label) => label.toLowerCase().startsWith("channel:"));
  const channel = channelLabel === undefined ? "" : channelLabel.slice("channel:".length).trim().toLowerCase();
  const firstLine = issue.description.split("\n")[0]?.trim() ?? "";
  return {
    id: "",
    source: channel === "" ? "linear" : channel,
    url: /^https?:\/\//.test(firstLine) ? firstLine : issue.url,
    company,
    title: role,
    ...(issue.createdAt === "" ? {} : { postedAt: issue.createdAt }),
  };
}

function importIssue(issue: LinearIssue, importer: Importer): void {
  const label = issue.identifier === "" ? issue.id : issue.identifier;
  const posting = toPosting(issue);
  if (posting.company === "") {
    importer.warn(`issue ${label} has no "<role> at <company>" or "<company> - <role>" title; skipped`);
    return;
  }
  const key = importer.lead(posting, KEY_MARKER.exec(issue.description)?.[1]?.trim());
  const state = mapState(issue.stateName);
  if (state === null) importer.unknownState(`Linear state "${issue.stateName}" on ${label}`);
  else if (state !== "lead" && !importer.hadLead(key)) importer.status(key, state, issue.id);
  importer.note(key, `linear ${label}; state ${issue.stateName}; created ${issue.createdAt}; ${issue.url}`);
}

export async function importLinear(
  ctx: CommandContext,
  options: LinearImportOptions,
): Promise<ImportResult> {
  if (ctx.dataDir === null) {
    return fail("data-dir-not-found", "no data dir resolved; pass --data or set HUNTLINE_HOME");
  }
  const apiKey = ctx.env["LINEAR_API_KEY"];
  if (apiKey === undefined || apiKey === "") return fail("migrate-linear-no-key", "LINEAR_API_KEY is not set");
  const send: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const issues = await fetchAll(send, apiKey, options);
  if (!issues.ok) return issues;
  const scope = options.project === undefined ? options.team : `${options.team}:${options.project}`;
  return withImporter(ctx.dataDir, `linear:${scope}`, "migrate-linear.json", (importer) => {
    for (const issue of issues.value) importIssue(issue, importer);
  });
}
