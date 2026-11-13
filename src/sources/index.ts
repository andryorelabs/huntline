import type { SourceAdapter } from "../core/types.ts";
import { createAtsAdapters } from "./ats.ts";
import { createBoardAdapters } from "./boards.ts";
import type { FetchFunction } from "./http.ts";

export type { FetchFunction } from "./http.ts";

export function createSources(fetchFunction: FetchFunction): Record<string, SourceAdapter> {
  const adapters = [...createAtsAdapters(fetchFunction), ...createBoardAdapters(fetchFunction)];
  return Object.fromEntries(adapters.map((adapter) => [adapter.name, adapter]));
}

export const sources: Record<string, SourceAdapter> = createSources((input, init) =>
  fetch(input, init),
);

export { resolveBoards, type ResolvedBoard } from "./resolve.ts";
