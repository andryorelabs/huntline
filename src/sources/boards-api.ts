import type {
  Posting,
  Salary,
  SalaryPeriod,
  SourceAdapter,
  SourceQuery,
  SourceResult,
  WorkMode,
} from "../core/types.ts";
import { isObject } from "../core/narrow.ts";
import {
  field,
  getJson,
  identifier,
  isoDate,
  number,
  postJson,
  records,
  stripHtml,
  text,
  type FetchFunction,
  type JsonOutcome,
} from "./http.ts";
import {
  mapRows,
  matchesKeywords,
  withOptional,
  type Parsed,
  type ParseFailure,
} from "./adapter.ts";

type ApiParse = (body: unknown, query: SourceQuery) => Parsed | ParseFailure;

export type ApiBoardName =
  | "remotive"
  | "jobicy"
  | "arbeitnow"
  | "workingnomads"
  | "hnjobs"
  | "jobtech"
  | "mycareersfuture"
  | "bundesagentur"
  | "eures"
  | "cbop";

export type ApiEndpoints = Partial<Record<ApiBoardName, string>>;

const DEFAULT_ENDPOINTS: Record<ApiBoardName, string> = {
  remotive: "https://remotive.com/api/remote-jobs",
  jobicy: "https://jobicy.com/api/v2/remote-jobs?count=50&geo=&industry=",
  arbeitnow: "https://www.arbeitnow.com/api/job-board-api?page=1",
  workingnomads: "https://www.workingnomads.com/api/exposed_jobs/",
  hnjobs: "https://hacker-news.firebaseio.com/v0/jobstories.json",
  jobtech: "https://jobsearch.api.jobtechdev.se/search?q=&limit=100",
  mycareersfuture: "https://api.mycareersfuture.gov.sg/v2/jobs?limit=100&sortBy=new_posting_date",
  bundesagentur:
    "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?angebotsart=1&size=100",
  eures: "https://europa.eu/eures/api/jv-searchengine/public/jv-search/search",
  cbop: "https://oferty.praca.gov.pl/portal-api/v3/oferta/wyszukiwanie?page=0&size=100&sort=dataDodaniaCbop,desc",
};

const HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";
const HN_ITEM_CAP = 30;
const BUNDESAGENTUR_CLIENT_ID = "jobboerse-jobsuche";
const EURES_ATTRIBUTION = "source: European Labour Authority (EURES)";

function failed(message: string): SourceResult {
  return { postings: [], errors: [message], warnings: [] };
}

function conclude(
  name: string,
  outcome: JsonOutcome,
  parse: ApiParse,
  query: SourceQuery,
  extraWarnings: readonly string[] = [],
): SourceResult {
  if (!outcome.ok) return failed(`${name}: ${outcome.error}`);
  let parsed: Parsed | ParseFailure;
  try {
    parsed = parse(outcome.body, query);
  } catch {
    return failed(`${name}: unexpected response shape`);
  }
  if ("error" in parsed) return failed(`${name}: ${parsed.error}`);
  return {
    postings: parsed.postings.filter((posting) => matchesKeywords(posting, query.keywords)),
    errors: [],
    warnings: [...extraWarnings, ...parsed.warnings],
  };
}

function simpleAdapter(
  name: ApiBoardName,
  endpoint: string,
  fetchFunction: FetchFunction,
  parse: ApiParse,
  headers: Record<string, string> = {},
): SourceAdapter {
  return {
    name,
    async fetch(query) {
      return conclude(name, await getJson(fetchFunction, endpoint, headers), parse, query);
    },
  };
}

function salaryOf(
  min: unknown,
  max: unknown,
  currency: string | undefined,
  period: SalaryPeriod | undefined,
): Salary | undefined {
  const low = number(min);
  const high = number(max);
  if ((low === undefined || low === 0) && (high === undefined || high === 0)) return undefined;
  const entries = Object.entries({ min: low, max: high, currency, period }).filter(
    ([, value]) => value !== undefined,
  );
  return Object.fromEntries(entries);
}

function periodOf(value: unknown): SalaryPeriod | undefined {
  const label = text(value)?.toLowerCase();
  if (label === undefined) return undefined;
  if (label.startsWith("month")) return "month";
  if (label.startsWith("year") || label.startsWith("annual")) return "year";
  return undefined;
}

function described(value: unknown): string | undefined {
  const raw = text(value);
  return raw === undefined ? undefined : stripHtml(raw);
}

function booleanMode(value: unknown, whenTrue: WorkMode): WorkMode | undefined {
  if (typeof value !== "boolean") return undefined;
  return value ? whenTrue : "onsite";
}

function categoryOf(endpoint: string): string | undefined {
  try {
    return text(new URL(endpoint).searchParams.get("category"));
  } catch {
    return undefined;
  }
}

function remotiveParse(endpoint: string): ApiParse {
  const category = categoryOf(endpoint)?.toLowerCase();
  return (body) => {
    const rows = records(field(body, "jobs"))?.filter(
      (row) =>
        category === undefined || text(row["category"])?.toLowerCase().includes(category) === true,
    );
    return mapRows(rows, "jobs", (row) => {
      const id = identifier(row["id"]);
      const title = text(row["title"]);
      const url = text(row["url"]);
      if (id === undefined || title === undefined || url === undefined) return undefined;
      return withOptional(
        {
          id: `remotive:${id}`,
          source: "remotive",
          url,
          company: text(row["company_name"]) ?? "unknown",
          title,
        },
        {
          location: text(row["candidate_required_location"]),
          remote: true,
          workMode: "remote",
          contract: text(row["job_type"]),
          description: described(row["description"]),
          postedAt: isoDate(row["publication_date"]),
        },
      );
    });
  };
}

const parseJobicy: ApiParse = (body) =>
  mapRows(records(field(body, "jobs")), "jobs", (row) => {
    const id = identifier(row["id"]);
    const title = text(row["jobTitle"]);
    const url = text(row["url"]);
    if (id === undefined || title === undefined || url === undefined) return undefined;
    const types = row["jobType"];
    return withOptional(
      {
        id: `jobicy:${id}`,
        source: "jobicy",
        url,
        company: text(row["companyName"]) ?? "unknown",
        title,
      },
      {
        location: text(row["jobGeo"]),
        remote: true,
        workMode: "remote",
        contract: Array.isArray(types) ? text(types[0]) : text(types),
        salary: salaryOf(
          row["salaryMin"],
          row["salaryMax"],
          text(row["salaryCurrency"]),
          periodOf(row["salaryPeriod"]),
        ),
        description: described(row["jobExcerpt"]),
        postedAt: isoDate(row["pubDate"]),
      },
    );
  });

function remoteOnly(endpoint: string): boolean {
  try {
    return new URL(endpoint).searchParams.get("remote") === "true";
  } catch {
    return false;
  }
}

const parseArbeitnow = (endpoint: string): ApiParse => {
  const onlyRemote = remoteOnly(endpoint);
  return (body) => parseArbeitnowRows(body, onlyRemote);
};

const parseArbeitnowRows = (body: unknown, onlyRemote: boolean): Parsed | ParseFailure =>
  mapRows(
    records(field(body, "data"))?.filter((row) => !onlyRemote || row["remote"] === true),
    "jobs",
    (row) => {
      const slug = identifier(row["slug"]);
      const title = text(row["title"]);
      const url = text(row["url"]);
      if (slug === undefined || title === undefined || url === undefined) return undefined;
      const jobTypes = row["job_types"];
      const tags = row["tags"];
      return withOptional(
        {
          id: `arbeitnow:${slug}`,
          source: "arbeitnow",
          url,
          company: text(row["company_name"]) ?? "unknown",
          title,
        },
        {
          location: text(row["location"]),
          remote: typeof row["remote"] === "boolean" ? row["remote"] : undefined,
          workMode: booleanMode(row["remote"], "remote"),
          contract: Array.isArray(jobTypes) ? text(jobTypes[0]) : undefined,
          stack: Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string") : undefined,
          description: described(row["description"]),
          postedAt: isoDate(row["created_at"]),
        },
      );
    },
  );

const parseWorkingNomads: ApiParse = (body) =>
  mapRows(Array.isArray(body) ? records(body) : undefined, "jobs", (row) => {
    const url = text(row["url"]);
    const title = text(row["title"]);
    if (url === undefined || title === undefined) return undefined;
    return withOptional(
      {
        id: `workingnomads:${url}`,
        source: "workingnomads",
        url,
        company: text(row["company_name"]) ?? "unknown",
        title,
      },
      {
        location: text(row["location"]),
        remote: true,
        workMode: "remote",
        description: described(row["description"]),
        postedAt: isoDate(row["pub_date"]),
      },
    );
  });

function hnCompany(title: string): string {
  const match = /^(.+?)\s+(?:\(.*?\)\s+)?is hiring/i.exec(title);
  return match?.[1]?.trim() || "unknown";
}

function hnPosting(row: Record<string, unknown>): Posting | undefined {
  const id = identifier(row["id"]);
  const title = text(row["title"]);
  if (id === undefined || title === undefined || row["type"] !== "job") return undefined;
  return withOptional(
    {
      id: `hnjobs:${id}`,
      source: "hnjobs",
      url: text(row["url"]) ?? `https://news.ycombinator.com/item?id=${id}`,
      company: hnCompany(title),
      title,
    },
    { description: described(row["text"]), postedAt: isoDate(row["time"]) },
  );
}

function hnJobs(endpoint: string, fetchFunction: FetchFunction): SourceAdapter {
  return {
    name: "hnjobs",
    async fetch(query) {
      const listing = await getJson(fetchFunction, endpoint);
      if (!listing.ok) return failed(`hnjobs: ${listing.error}`);
      if (!Array.isArray(listing.body)) return failed("hnjobs: unexpected response shape");
      const ids = listing.body.filter((id) => typeof id === "number").slice(0, HN_ITEM_CAP);
      const outcomes = await Promise.all(
        ids.map((id) => getJson(fetchFunction, `${HN_ITEM_URL}/${id}.json`)),
      );
      const postings: Posting[] = [];
      const warnings: string[] = [];
      outcomes.forEach((outcome, index) => {
        const posting = outcome.ok && isObject(outcome.body) ? hnPosting(outcome.body) : undefined;
        if (posting === undefined) warnings.push(`skipped item ${ids[index]}`);
        else if (matchesKeywords(posting, query.keywords)) postings.push(posting);
      });
      return { postings, errors: [], warnings };
    },
  };
}

const parseJobTech: ApiParse = (body) =>
  mapRows(records(field(body, "hits")), "hits", (row) => {
    const id = identifier(row["id"]);
    const title = text(row["headline"]);
    const url = text(row["webpage_url"]);
    if (id === undefined || title === undefined || url === undefined) return undefined;
    const address = row["workplace_address"];
    const location = [text(field(address, "municipality")), text(field(address, "country"))]
      .filter((part) => part !== undefined)
      .join(", ");
    return withOptional(
      {
        id: `jobtech:${id}`,
        source: "jobtech",
        url,
        company: text(field(row["employer"], "name")) ?? "unknown",
        title,
      },
      {
        location: location === "" ? undefined : location,
        remote: typeof row["remote"] === "boolean" ? row["remote"] : undefined,
        workMode: booleanMode(row["remote"], "remote"),
        description: described(field(row["description"], "text")),
        postedAt: isoDate(row["publication_date"]),
      },
    );
  });

const parseMyCareersFuture: ApiParse = (body) =>
  mapRows(records(field(body, "results")), "jobs", (row) => {
    const id = identifier(row["uuid"]);
    const title = text(row["title"]);
    const metadata = row["metadata"];
    const url = text(field(metadata, "jobDetailsUrl"));
    if (id === undefined || title === undefined || url === undefined) return undefined;
    const salary = row["salary"];
    return withOptional(
      {
        id: `mycareersfuture:${id}`,
        source: "mycareersfuture",
        url,
        company: text(field(row["postedCompany"], "name")) ?? "unknown",
        title,
      },
      {
        salary: salaryOf(
          field(salary, "minimum"),
          field(salary, "maximum"),
          "SGD",
          periodOf(field(field(salary, "type"), "salaryType")),
        ),
        description: described(row["description"]),
        postedAt: isoDate(field(metadata, "newPostingDate")),
      },
    );
  });

const parseBundesagentur: ApiParse = (body) =>
  mapRows(records(field(body, "ergebnisliste")), "jobs", (row) => {
    const reference = identifier(row["referenznummer"]);
    const title = text(row["stellenangebotsTitel"]) ?? text(row["hauptberuf"]);
    if (reference === undefined || title === undefined) return undefined;
    const locations = row["stellenlokationen"];
    const address = field(Array.isArray(locations) ? locations[0] : undefined, "adresse");
    const location = [text(field(address, "ort")), text(field(address, "region"))]
      .filter((part) => part !== undefined)
      .join(", ");
    return withOptional(
      {
        id: `bundesagentur:${reference}`,
        source: "bundesagentur",
        url: `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(reference)}`,
        company: text(row["firma"]) ?? "unknown",
        title,
      },
      {
        location: location === "" ? undefined : location,
        postedAt: isoDate(
          row["datumErsteVeroeffentlichung"] ?? field(row["veroeffentlichungszeitraum"], "von"),
        ),
      },
    );
  });

const parseEures: ApiParse = (body) =>
  mapRows(records(field(body, "jvs")), "jobs", (row) => {
    const id = identifier(row["id"]);
    const title = text(row["title"]);
    if (id === undefined || title === undefined) return undefined;
    const places = Object.values(isObject(row["locationMap"]) ? row["locationMap"] : {}).flat();
    return withOptional(
      {
        id: `eures:${id}`,
        source: "eures",
        url: `https://europa.eu/eures/portal/jv-se/jv-details/${encodeURIComponent(id)}`,
        company: text(field(row["employer"], "name")) ?? "unknown",
        title,
      },
      {
        location: places.filter((place) => typeof place === "string").join(", ") || undefined,
        description: described(row["description"]),
        postedAt: isoDate(row["creationDate"]),
      },
    );
  });

function euresBody(query: SourceQuery): Record<string, unknown> {
  return {
    keywords: (query.keywords ?? []).map((keyword) => ({
      keyword,
      specificSearchCode: "EVERYWHERE",
    })),
    sortSearch: "MOST_RECENT",
    resultsPerPage: 50,
    page: 1,
    publicationPeriod: "LAST_WEEK",
  };
}

function polishDate(value: unknown): string | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text(value) ?? "");
  return match === null ? undefined : isoDate(`${match[3]}-${match[2]}-${match[1]}`);
}

const parseCbop: ApiParse = (body) => {
  const page = field(field(body, "payload"), "ofertyPracyPage");
  return mapRows(records(field(page, "content")), "jobs", (row) => {
    const id = identifier(row["id"]);
    const title = text(row["stanowisko"]);
    if (id === undefined || title === undefined) return undefined;
    return withOptional(
      {
        id: `cbop:${id}`,
        source: "cbop",
        url: `https://oferty.praca.gov.pl/portal/index.cbop#/szczegolyOferty/${encodeURIComponent(id)}`,
        company: text(row["pracodawca"]) ?? "unknown",
        title,
      },
      {
        location: text(row["miejscePracy"]),
        contract: text(row["rodzajUmowy"]),
        description: described(row["zakresObowiazkow"]),
        postedAt: polishDate(row["dataDodaniaCbop"]),
      },
    );
  });
};

function euresAdapter(endpoint: string, fetchFunction: FetchFunction): SourceAdapter {
  return {
    name: "eures",
    async fetch(query) {
      const outcome = await postJson(fetchFunction, endpoint, euresBody(query));
      return conclude("eures", outcome, parseEures, query, [EURES_ATTRIBUTION]);
    },
  };
}

function cbopAdapter(endpoint: string, fetchFunction: FetchFunction): SourceAdapter {
  return {
    name: "cbop",
    async fetch(query) {
      return conclude("cbop", await postJson(fetchFunction, endpoint, {}), parseCbop, query);
    },
  };
}

export function createApiBoardAdapters(
  fetchFunction: FetchFunction,
  endpoints: ApiEndpoints = {},
): SourceAdapter[] {
  const at = (name: ApiBoardName): string => endpoints[name] ?? DEFAULT_ENDPOINTS[name];
  return [
    simpleAdapter("remotive", at("remotive"), fetchFunction, remotiveParse(at("remotive"))),
    simpleAdapter("jobicy", at("jobicy"), fetchFunction, parseJobicy),
    simpleAdapter("arbeitnow", at("arbeitnow"), fetchFunction, parseArbeitnow(at("arbeitnow"))),
    simpleAdapter("workingnomads", at("workingnomads"), fetchFunction, parseWorkingNomads),
    hnJobs(at("hnjobs"), fetchFunction),
    simpleAdapter("jobtech", at("jobtech"), fetchFunction, parseJobTech),
    simpleAdapter("mycareersfuture", at("mycareersfuture"), fetchFunction, parseMyCareersFuture),
    simpleAdapter("bundesagentur", at("bundesagentur"), fetchFunction, parseBundesagentur, {
      "X-API-Key": BUNDESAGENTUR_CLIENT_ID,
    }),
    euresAdapter(at("eures"), fetchFunction),
    cbopAdapter(at("cbop"), fetchFunction),
  ];
}
