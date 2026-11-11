const typesOnly = "type declarations only; nothing to execute, so nothing a test could cover";
const reachedThroughSiblings =
  "no test imports it directly; exercised through the modules that import it and measured by the coverage threshold";

/**
 * Source modules that no test imports directly, each with the reason it is covered another way.
 * Add a test instead of adding an entry; remove an entry as soon as a test imports the module.
 */
export const coverageExemptions: Readonly<Record<string, string>> = {
  "src/apply/command.ts": reachedThroughSiblings,
  "src/apply/types.ts": typesOnly,
  "src/e2e/stub-fetch.preload.ts":
    "test preload loaded by the end-to-end flow test through the bun preload option, never imported",
  "src/migrate/importer.ts": reachedThroughSiblings,
  "src/migrate/states.ts": reachedThroughSiblings,
  "src/migrate/sweep-leads.ts": reachedThroughSiblings,
  "src/migrate/types.ts": typesOnly,
  "src/outreach/types.ts": typesOnly,
  "src/sources/adapter.ts": reachedThroughSiblings,
  "src/sources/ats.ts": reachedThroughSiblings,
  "src/sources/boards.ts": reachedThroughSiblings,
  "src/sources/companies.ts": reachedThroughSiblings,
  "src/sweep/pipeline.ts": reachedThroughSiblings,
  "src/sweep/types.ts": typesOnly,
  "src/tracker/local.ts": reachedThroughSiblings,
};
