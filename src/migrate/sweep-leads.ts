import type { Posting } from "../core/types.ts";
import { extractUrl } from "./table.ts";
import { splitCompanyRole } from "./title.ts";

export type SweepLead = {
  readonly heading: string;
  readonly fields: Readonly<Record<string, string>>;
};

const HEADING = /^###\s+(.+?)\s*$/;
const FIELD = /^\s*(?:[-*]\s+)?\*\*([^*:]+):\*\*\s*(.*?)\s*$/;
const OTHER_HEADING = /^#{1,6}\s/;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

export function parseSweepLeads(markdown: string): SweepLead[] {
  const leads: SweepLead[] = [];
  let heading: string | null = null;
  let fields: Record<string, string> = {};
  const flush = (): void => {
    if (heading !== null && (heading.includes(" - ") || Object.keys(fields).length > 0)) {
      leads.push({ heading, fields });
    }
  };
  for (const line of markdown.split(/\r?\n/)) {
    const opened = HEADING.exec(line);
    if (opened !== null || OTHER_HEADING.test(line)) {
      flush();
      heading = opened?.[1] ?? null;
      fields = {};
      continue;
    }
    const field = FIELD.exec(line);
    if (heading !== null && field?.[1] !== undefined) {
      fields = { ...fields, [field[1].trim().toLowerCase()]: field[2] ?? "" };
    }
  }
  flush();
  return leads;
}

export function leadIdentity(lead: SweepLead): { company: string; role: string } {
  const split = splitCompanyRole(lead.heading);
  return {
    company: lead.fields["company"] || split.company,
    role: lead.fields["role"] || (split.company === "" ? "" : split.role),
  };
}

export function leadPosting(
  lead: SweepLead,
  company: string,
  role: string,
  fallbackDate: string,
): Posting {
  const portal = (lead.fields["source portal"] ?? "").toLowerCase();
  const posted = DATE_PATTERN.exec(lead.fields["posted"] ?? "")?.[0] ?? fallbackDate;
  const contract = lead.fields["contract"] ?? "";
  const stack = (lead.fields["stack"] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return {
    id: "",
    source: portal === "" ? "legacy" : portal,
    url: extractUrl(lead.fields["url"] ?? ""),
    company,
    title: role,
    ...(contract === "" ? {} : { contract }),
    ...(stack.length === 0 ? {} : { stack }),
    ...(posted === "" ? {} : { postedAt: posted }),
  };
}
