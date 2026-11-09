import type { Posting, Salary, SourceAdapter, SourceQuery, SourceResult } from "../core/types.ts";
import { getJson, field, identifier, isoDate, number, records, stripHtml, text, type FetchFunction } from "./http.ts";
import { defineAdapter, mapRows, matchesKeywords, withOptional, type AdapterSpec } from "./adapter.ts";

function salaryOf(min: unknown, max: unknown, currency: unknown): Salary | undefined {
  const low = number(min);
  const high = number(max);
  if ((low === undefined || low === 0) && (high === undefined || high === 0)) return undefined;
  return withSalary(low, high, text(currency));
}

function withSalary(low: number | undefined, high: number | undefined, currency: string | undefined): Salary {
  const entries = Object.entries({ min: low, max: high, currency }).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
}

function keywordQuery(query: SourceQuery): string {
  return encodeURIComponent((query.keywords ?? []).join(" "));
}

function filterByKeywords(
  parsed: ReturnType<AdapterSpec["parse"]>,
  query: SourceQuery,
): ReturnType<AdapterSpec["parse"]> {
  if ("error" in parsed) return parsed;
  return { ...parsed, postings: parsed.postings.filter((posting) => matchesKeywords(posting, query.keywords)) };
}

const getonboard: AdapterSpec = {
  name: "getonboard",
  requiresSlug: false,
  url: (query) => `https://www.getonbrd.com/api/v0/search/jobs?query=${keywordQuery(query)}&per_page=100`,
  parse: (body) =>
    mapRows(records(field(body, "data")), "jobs", (row) => {
      const id = identifier(row["id"]);
      const attributes = row["attributes"];
      const title = text(field(attributes, "title"));
      const url = text(field(row["links"], "public_url"));
      const company = text(field(field(field(field(attributes, "company"), "data"), "attributes"), "name"));
      if (id === undefined || title === undefined || url === undefined) return undefined;
      const countries = field(attributes, "countries");
      const location = Array.isArray(countries)
        ? countries.filter((entry): entry is string => typeof entry === "string").join(", ")
        : undefined;
      const description = text(field(attributes, "description"));
      const remote = field(attributes, "remote");
      return withOptional(
        { id: `getonboard:${id}`, source: "getonboard", url, company: company ?? "unknown", title },
        {
          location: location === "" ? undefined : location,
          remote: typeof remote === "boolean" ? remote : undefined,
          salary: salaryOf(field(attributes, "min_salary"), field(attributes, "max_salary"), "USD"),
          description: description === undefined ? undefined : stripHtml(description),
          postedAt: isoDate(field(attributes, "published_at")),
        },
      );
    }),
};

const himalayas: AdapterSpec = {
  name: "himalayas",
  requiresSlug: false,
  url: () => "https://himalayas.app/jobs/api?limit=100",
  parse: (body, query) =>
    filterByKeywords(
      mapRows(records(field(body, "jobs")), "jobs", (row) => {
        const id = identifier(row["guid"]);
        const title = text(row["title"]);
        const url = text(row["applicationLink"]);
        const company = text(row["companyName"]);
        if (id === undefined || title === undefined || url === undefined || company === undefined) return undefined;
        const restrictions = row["locationRestrictions"];
        const location = Array.isArray(restrictions)
          ? restrictions.filter((entry): entry is string => typeof entry === "string").join(", ")
          : undefined;
        const description = text(row["description"]);
        return withOptional(
          { id: `himalayas:${id}`, source: "himalayas", url, company, title },
          {
            location: location === "" ? undefined : location,
            remote: true,
            contract: text(row["employmentType"]),
            salary: salaryOf(row["minSalary"], row["maxSalary"], row["currency"]),
            description: description === undefined ? undefined : stripHtml(description),
            postedAt: isoDate(row["pubDate"]),
          },
        );
      }),
      query,
    ),
};

const remoteok: AdapterSpec = {
  name: "remoteok",
  requiresSlug: false,
  url: () => "https://remoteok.com/api",
  parse: (body, query) =>
    filterByKeywords(
      mapRows(records(body)?.filter((row) => "id" in row), "jobs", (row) => {
        const id = identifier(row["id"]);
        const title = text(row["position"]);
        const url = text(row["url"]);
        const company = text(row["company"]);
        if (id === undefined || title === undefined || url === undefined || company === undefined) return undefined;
        const tags = Array.isArray(row["tags"])
          ? row["tags"].filter((entry): entry is string => typeof entry === "string")
          : undefined;
        const description = text(row["description"]);
        return withOptional(
          { id: `remoteok:${id}`, source: "remoteok", url, company, title },
          {
            location: text(row["location"]),
            remote: true,
            stack: tags,
            salary: salaryOf(row["salary_min"], row["salary_max"], "USD"),
            description: description === undefined ? undefined : stripHtml(description),
            postedAt: isoDate(row["date"]),
          },
        );
      }),
      query,
    ),
};

const HN_STORY_SEARCH =
  "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=%22who%20is%20hiring%22&hitsPerPage=5";

function hnCommentsUrl(storyId: string): string {
  return `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=1000`;
}

function latestHiringStory(body: unknown): string | undefined {
  const story = records(field(body, "hits"))?.find((hit) => /who is hiring/i.test(text(hit["title"]) ?? ""));
  return story === undefined ? undefined : identifier(story["objectID"]);
}

function hnPosting(row: Record<string, unknown>): Posting | undefined {
  const id = identifier(row["objectID"]);
  const raw = text(row["comment_text"]);
  if (id === undefined || raw === undefined) return undefined;
  const lines = stripHtml(raw).split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const headline = lines[0] ?? "";
  const segments = headline.split("|").map((segment) => segment.trim());
  const company = segments[0];
  if (company === undefined || company === "" || segments.length < 2) return undefined;
  return withOptional(
    {
      id: `hn:${id}`,
      source: "hn",
      url: `https://news.ycombinator.com/item?id=${id}`,
      company,
      title: segments[1] ?? headline,
    },
    {
      remote: /remote/i.test(headline) ? true : undefined,
      description: lines.join("\n"),
      postedAt: isoDate(row["created_at"]),
    },
  );
}

function parseHnComments(body: unknown, query: SourceQuery): ReturnType<AdapterSpec["parse"]> {
  const rows = records(field(body, "hits"));
  if (rows === undefined) return { error: "unexpected response shape, missing hits" };
  const postings = rows.map(hnPosting).filter((posting) => posting !== undefined);
  const skipped = rows.length - postings.length;
  const warnings = skipped === 0 ? [] : [`skipped ${skipped} comments that are not job posts`];
  return { postings: postings.filter((posting) => matchesKeywords(posting, query.keywords)), warnings };
}

function hn(fetchFunction: FetchFunction): SourceAdapter {
  return {
    name: "hn",
    async fetch(query): Promise<SourceResult> {
      const storyOutcome = await getJson(fetchFunction, HN_STORY_SEARCH);
      if (!storyOutcome.ok) return { postings: [], errors: [`hn: ${storyOutcome.error}`], warnings: [] };
      const storyId = latestHiringStory(storyOutcome.body);
      if (storyId === undefined) {
        return { postings: [], errors: ["hn: no Who is hiring thread found in the response"], warnings: [] };
      }
      const delegate = defineAdapter(
        {
          name: "hn",
          requiresSlug: false,
          url: () => hnCommentsUrl(storyId),
          parse: (body) => parseHnComments(body, query),
        },
        fetchFunction,
      );
      return delegate.fetch(query);
    },
  };
}

export function createBoardAdapters(fetchFunction: FetchFunction): SourceAdapter[] {
  return [
    defineAdapter(getonboard, fetchFunction),
    defineAdapter(himalayas, fetchFunction),
    defineAdapter(remoteok, fetchFunction),
    hn(fetchFunction),
  ];
}
