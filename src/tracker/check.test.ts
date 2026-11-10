import { describe, expect, test } from "bun:test";
import { checkLinearConnection } from "./check.ts";
import { DEFAULT_LINEAR_MAPPING, type FetchLike } from "./linear.ts";

const API_KEY = "lin_api_synthetic_secret_key";

function teamResponse(stateNames: readonly string[], key = "JOB"): Response {
  const body = {
    data: {
      teams: {
        nodes: [
          {
            id: "team-acme",
            key,
            states: { nodes: stateNames.map((name, index) => ({ id: `st-${index}`, name })) },
          },
        ],
      },
    },
  };
  return new Response(JSON.stringify(body), { status: 200 });
}

function stub(respond: () => Response): FetchLike {
  return () => Promise.resolve(respond());
}

function bodyText(init: RequestInit): string {
  if (typeof init.body !== "string") throw new Error("expected a string request body");
  return init.body;
}

const ALL_STATES = ["Backlog", "Todo", "In Progress", "Done", "Canceled"];

describe("checkLinearConnection", () => {
  test("returns the team id when everything matches", async () => {
    const fetchStub = stub(() => teamResponse(ALL_STATES));
    const result = await checkLinearConnection({
      apiKey: API_KEY,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(result).toEqual({ ok: true, value: { teamId: "team-acme" } });
  });

  test("matches state names case-insensitively like the tracker does", async () => {
    const fetchStub = stub(() => teamResponse(ALL_STATES.map((name) => name.toLowerCase())));
    const result = await checkLinearConnection({
      apiKey: API_KEY,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(result).toEqual({ ok: true, value: { teamId: "team-acme" } });
  });

  test("lists a missing state with the exact message", async () => {
    const fetchStub = stub(() => teamResponse(ALL_STATES.filter((name) => name !== "In Progress")));
    const result = await checkLinearConnection({
      apiKey: API_KEY,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(result).toEqual({
      ok: false,
      error: { problems: ['state "In Progress" not found in team JOB'] },
    });
  });

  test("reports every missing state once per unique name", async () => {
    const fetchStub = stub(() => teamResponse(["Backlog"]));
    const result = await checkLinearConnection({
      apiKey: API_KEY,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(result).toEqual({
      ok: false,
      error: {
        problems: [
          'state "Todo" not found in team JOB',
          'state "In Progress" not found in team JOB',
          'state "Done" not found in team JOB',
          'state "Canceled" not found in team JOB',
        ],
      },
    });
  });

  test("reports the missing key without calling the network", async () => {
    let calls = 0;
    const fetchStub: FetchLike = () => {
      calls += 1;
      return Promise.resolve(teamResponse(ALL_STATES));
    };
    const result = await checkLinearConnection({
      apiKey: undefined,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(calls).toBe(0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.problems.join("\n")).toContain("LINEAR_API_KEY");
  });

  test("reports a missing team setting alongside a missing key", async () => {
    const result = await checkLinearConnection({
      apiKey: "",
      team: undefined,
      mapping: DEFAULT_LINEAR_MAPPING,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.problems).toHaveLength(2);
      expect(result.error.problems[0]).toContain("LINEAR_API_KEY");
    }
  });

  test.each([401, 403])("reports a rejected key on HTTP %d", async (status) => {
    {
      const fetchStub = stub(() => new Response("{}", { status }));
      const result = await checkLinearConnection({
        apiKey: API_KEY,
        team: "JOB",
        mapping: DEFAULT_LINEAR_MAPPING,
        fetch: fetchStub,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.problems).toHaveLength(1);
        expect(result.error.problems[0]).toContain(String(status));
        expect(result.error.problems[0]).not.toContain(API_KEY);
      }
    }
  });

  test("reports GraphQL errors as a rejected request", async () => {
    const fetchStub = stub(
      () =>
        new Response(JSON.stringify({ errors: [{ message: "Authentication required" }] }), {
          status: 200,
        }),
    );
    const result = await checkLinearConnection({
      apiKey: API_KEY,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.problems[0]).toContain("Authentication required");
  });

  test("reports an unknown team key", async () => {
    const fetchStub = stub(
      () => new Response(JSON.stringify({ data: { teams: { nodes: [] } } }), { status: 200 }),
    );
    const result = await checkLinearConnection({
      apiKey: API_KEY,
      team: "GLX",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(result).toEqual({ ok: false, error: { problems: ["team GLX not found"] } });
  });

  test("reports network failures without leaking the key", async () => {
    const fetchStub = stub(() => {
      throw new Error(`connect failed for ${API_KEY}`);
    });
    const result = await checkLinearConnection({
      apiKey: API_KEY,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.problems.join("\n")).not.toContain(API_KEY);
  });

  test("sends a single read-only query", async () => {
    const bodies: string[] = [];
    const fetchStub: FetchLike = (_input, init) => {
      bodies.push(bodyText(init));
      return Promise.resolve(teamResponse(ALL_STATES));
    };
    await checkLinearConnection({
      apiKey: API_KEY,
      team: "JOB",
      mapping: DEFAULT_LINEAR_MAPPING,
      fetch: fetchStub,
    });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toContain("mutation");
  });
});
