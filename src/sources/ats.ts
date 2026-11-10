import { isObject } from "../core/narrow.ts";
import { defineAdapter, mapRows, withOptional, type AdapterSpec } from "./adapter.ts";
import {
  field,
  identifier,
  isoDate,
  records,
  stripHtml,
  text,
  type FetchFunction,
} from "./http.ts";

function joined(...parts: (string | undefined)[]): string | undefined {
  const present = parts.filter((part) => part !== undefined);
  return present.length === 0 ? undefined : present.join(", ");
}

const greenhouse: AdapterSpec = {
  name: "greenhouse",
  requiresSlug: true,
  url: (query) => `https://boards-api.greenhouse.io/v1/boards/${query.slug}/jobs?content=true`,
  parse: (body, query) =>
    mapRows(records(field(body, "jobs")), "jobs", (row) => {
      const slug = query.slug ?? "";
      const id = identifier(row["id"]);
      const title = text(row["title"]);
      const url = text(row["absolute_url"]);
      if (id === undefined || title === undefined || url === undefined) return undefined;
      const content = text(row["content"]);
      const location = text(field(row["location"], "name"));
      return withOptional(
        {
          id: `greenhouse:${slug}:${id}`,
          source: "greenhouse",
          url,
          company: text(row["company_name"]) ?? query.company ?? slug,
          title,
        },
        {
          location,
          remote: location === undefined ? undefined : /remote/i.test(location),
          description: content === undefined ? undefined : stripHtml(content),
          postedAt: isoDate(row["updated_at"]),
        },
      );
    }),
};

const lever: AdapterSpec = {
  name: "lever",
  requiresSlug: true,
  url: (query) => `https://api.lever.co/v0/postings/${query.slug}?mode=json`,
  parse: (body, query) =>
    mapRows(records(body), "postings", (row) => {
      const slug = query.slug ?? "";
      const id = identifier(row["id"]);
      const title = text(row["text"]);
      const url = text(row["hostedUrl"]);
      if (id === undefined || title === undefined || url === undefined) return undefined;
      const workplace = text(row["workplaceType"]);
      return withOptional(
        { id: `lever:${slug}:${id}`, source: "lever", url, company: query.company ?? slug, title },
        {
          location: text(field(row["categories"], "location")),
          contract: text(field(row["categories"], "commitment")),
          remote: workplace === undefined ? undefined : workplace === "remote",
          description: text(row["descriptionPlain"]),
          postedAt: isoDate(row["createdAt"]),
        },
      );
    }),
};

const ashby: AdapterSpec = {
  name: "ashby",
  requiresSlug: true,
  url: (query) => `https://api.ashbyhq.com/posting-api/job-board/${query.slug}`,
  parse: (body, query) =>
    mapRows(records(field(body, "jobs")), "jobs", (row) => {
      const slug = query.slug ?? "";
      const id = identifier(row["id"]);
      const title = text(row["title"]);
      const url = text(row["jobUrl"]);
      if (id === undefined || title === undefined || url === undefined) return undefined;
      return withOptional(
        { id: `ashby:${slug}:${id}`, source: "ashby", url, company: query.company ?? slug, title },
        {
          location: text(row["location"]),
          remote: typeof row["isRemote"] === "boolean" ? row["isRemote"] : undefined,
          contract: text(row["employmentType"]),
          description: text(row["descriptionPlain"]),
          postedAt: isoDate(row["publishedAt"]),
        },
      );
    }),
};

const workable: AdapterSpec = {
  name: "workable",
  requiresSlug: true,
  url: (query) => `https://apply.workable.com/api/v1/widget/accounts/${query.slug}`,
  parse: (body, query) =>
    mapRows(records(field(body, "jobs")), "jobs", (row) => {
      const slug = query.slug ?? "";
      const id = identifier(row["shortcode"]);
      const title = text(row["title"]);
      const url = text(row["url"]);
      if (id === undefined || title === undefined || url === undefined) return undefined;
      const description = text(row["description"]);
      return withOptional(
        {
          id: `workable:${slug}:${id}`,
          source: "workable",
          url,
          company: text(field(body, "name")) ?? query.company ?? slug,
          title,
        },
        {
          location: joined(text(row["city"]), text(row["country"])),
          remote: typeof row["telecommuting"] === "boolean" ? row["telecommuting"] : undefined,
          contract: text(row["employment_type"]),
          description: description === undefined ? undefined : stripHtml(description),
          postedAt: isoDate(row["published_on"]),
        },
      );
    }),
};

const smartrecruiters: AdapterSpec = {
  name: "smartrecruiters",
  requiresSlug: true,
  url: (query) => `https://api.smartrecruiters.com/v1/companies/${query.slug}/postings`,
  parse: (body, query) =>
    mapRows(records(field(body, "content")), "postings", (row) => {
      const slug = query.slug ?? "";
      const id = identifier(row["id"]);
      const title = text(row["name"]);
      if (id === undefined || title === undefined) return undefined;
      const location = row["location"];
      const remote = isObject(location) ? location["remote"] : undefined;
      return withOptional(
        {
          id: `smartrecruiters:${slug}:${id}`,
          source: "smartrecruiters",
          url: `https://jobs.smartrecruiters.com/${slug}/${id}`,
          company: text(field(row["company"], "name")) ?? query.company ?? slug,
          title,
        },
        {
          location: joined(text(field(location, "city")), text(field(location, "country"))),
          remote: typeof remote === "boolean" ? remote : undefined,
          contract: text(field(row["typeOfEmployment"], "label")),
          postedAt: isoDate(row["releasedDate"]),
        },
      );
    }),
};

const ATS_SPECS: readonly AdapterSpec[] = [greenhouse, lever, ashby, workable, smartrecruiters];

export function createAtsAdapters(fetchFunction: FetchFunction) {
  return ATS_SPECS.map((spec) => defineAdapter(spec, fetchFunction));
}
