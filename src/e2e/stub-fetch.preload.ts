import { readFileSync } from "node:fs";
import path from "node:path";

const FIXTURE = path.resolve(import.meta.dir, "../sources/fixtures/remoteok.json");

globalThis.fetch = Object.assign(
  (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("remoteok.com")) {
      return Promise.resolve(
        new Response(readFileSync(FIXTURE, "utf8"), { headers: { "content-type": "application/json" } }),
      );
    }
    return Promise.reject(new Error(`network blocked in e2e: ${url}`));
  },
  { preconnect: () => undefined },
);
