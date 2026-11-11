import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadBullets, loadFactBank, loadNeverClaim } from "../cv/facts.ts";
import { runGuardSelfTest, SELF_TEST_HOOKS } from "../guard/self-test.ts";
import { checkLinearConnection } from "../tracker/check.ts";
import { DEFAULT_LINEAR_MAPPING, type FetchLike, type LinearMapping } from "../tracker/linear.ts";
import type { CommandContext } from "./commands.ts";
import { createAtsAdapters } from "../sources/ats.ts";
import { readCompanies } from "../sources/companies.ts";
import { sources as registeredSources } from "../sources/index.ts";
import { CONFIG_FILE, loadProfileWithWarnings } from "./data-dir.ts";
import { LEGACY_PRODUCT_NAME, PRODUCT_NAME, settingValue } from "./env.ts";
import { failure, success, type Envelope } from "./envelope.ts";
import { MARKER } from "./init.ts";
import { errorMessage, isObject } from "./narrow.ts";
import { toolStatus } from "./tools.ts";
import type { DataDir, Profile } from "./types.ts";

const PLUGIN_RECOVERY_ACTION =
  "claude plugin marketplace add andryorelabs/huntline && claude plugin install jobship@jobship-marketplace";

export type DoctorDeps = { readonly fetch?: FetchLike; readonly guardHooks?: unknown };

type DoctorWarning = {
  readonly code: string;
  readonly message: string;
  readonly recoveryAction: string;
};

type PluginProbe = { readonly installed: boolean; readonly warning: DoctorWarning | null };

const SCANNED_EXTENSIONS = new Set([".yaml", ".yml", ".json"]);

type MarkerHit = { readonly file: string; readonly line: number };

function findMarkers(dir: DataDir): MarkerHit[] {
  const hits: MarkerHit[] = [];
  const names = readdirSync(dir.path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name)))
    .map((entry) => entry.name)
    .toSorted();
  for (const name of names) {
    const lines = readFileSync(path.join(dir.path, name), "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      if (line.includes(MARKER)) hits.push({ file: name, line: index + 1 });
    }
  }
  return hits;
}

function cvDataProblems(dir: DataDir): string[] {
  const present = (file: string): boolean => existsSync(path.join(dir.path, file));
  const problems: string[] = [];
  const facts = present("facts.yaml") ? loadFactBank(dir) : null;
  if (facts !== null && !facts.ok) problems.push(facts.error.message);
  const bullets = present("bullets.yaml") ? loadBullets(dir) : null;
  if (bullets !== null && !bullets.ok) problems.push(bullets.error.message);
  if (present("never-claim.yaml")) {
    const terms = loadNeverClaim(dir);
    if (!terms.ok) problems.push(terms.error.message);
  }
  if (facts?.ok === true && bullets?.ok === true) {
    const known = new Set(facts.value.facts.map((fact) => fact.id));
    for (const bullet of bullets.value) {
      for (const factId of bullet.factIds) {
        if (!known.has(factId))
          problems.push(`bullets.yaml: bullet ${bullet.id} cites missing fact ${factId}`);
      }
    }
  }
  return problems;
}

function parseProblem(dir: DataDir, file: string): string | null {
  const target = path.join(dir.path, file);
  if (!existsSync(target)) return null;
  try {
    JSON.parse(readFileSync(target, "utf8"));
    return null;
  } catch (error) {
    return `${file} is not valid JSON: ${errorMessage(error)}`;
  }
}

function eventLogProblem(dir: DataDir): string | null {
  const target = path.join(dir.path, "events.jsonl");
  if (!existsSync(target)) return null;
  const lines = readFileSync(target, "utf8").split("\n");
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") continue;
    try {
      JSON.parse(line);
    } catch (error) {
      return `events.jsonl line ${index + 1} is not valid JSON: ${errorMessage(error)}`;
    }
  }
  return null;
}

function dataFileProblems(dir: DataDir): string[] {
  const problems: string[] = [];
  const events = eventLogProblem(dir);
  if (events !== null) problems.push(events);
  const companies = readCompanies(dir);
  if (!companies.ok) problems.push(companies.error.message);
  const answers = parseProblem(dir, "answers.json");
  if (answers !== null) problems.push(answers);
  return problems;
}

function unknownSources(profile: Profile): string[] {
  const known = Object.keys(registeredSources);
  return profile.sources.filter((name) => !known.includes(name));
}

function atsWithoutCompanies(dir: DataDir, profile: Profile): DoctorWarning[] {
  const companies = readCompanies(dir);
  if (!companies.ok) return [];
  const atsNames = new Set(
    createAtsAdapters((input, init) => fetch(input, init)).map((adapter) => adapter.name),
  );
  return profile.sources
    .filter((name) => atsNames.has(name))
    .filter((name) => !companies.value.some((company) => company.ats === name))
    .map((name) => ({
      code: "ats-without-companies",
      message: `${name} is configured but no company is saved for it`,
      recoveryAction: `run jobship company add for ${name}`,
    }));
}

function pluginsFilePath(env: CommandContext["env"]): string {
  const override = settingValue(env, "CLAUDE_PLUGINS_FILE");
  if (override !== undefined) return override;
  const home = env["HOME"] !== undefined && env["HOME"] !== "" ? env["HOME"] : os.homedir();
  return path.join(home, ".claude", "plugins", "installed_plugins.json");
}

function pluginWarning(message: string): DoctorWarning {
  return { code: "guard-plugin-missing", message, recoveryAction: PLUGIN_RECOVERY_ACTION };
}

function probePlugin(env: CommandContext["env"]): PluginProbe {
  const file = pluginsFilePath(env);
  if (!existsSync(file)) {
    return { installed: false, warning: pluginWarning(`plugins file not found: ${file}`) };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return {
      installed: false,
      warning: pluginWarning(`could not read plugins file ${file}: ${errorMessage(error)}`),
    };
  }
  const plugins = isObject(parsed) ? parsed["plugins"] : undefined;
  if (!isObject(plugins)) {
    return {
      installed: false,
      warning: pluginWarning(`plugins file ${file} has no plugins object`),
    };
  }
  const prefixes = [`${PRODUCT_NAME}@`, `${LEGACY_PRODUCT_NAME}@`];
  if (Object.keys(plugins).some((key) => prefixes.some((prefix) => key.startsWith(prefix)))) {
    return { installed: true, warning: null };
  }
  return {
    installed: false,
    warning: pluginWarning("the jobship plugin is not installed in Claude Code"),
  };
}

function linearMapping(tracker: Profile["tracker"]): LinearMapping {
  return {
    states: { ...DEFAULT_LINEAR_MAPPING.states, ...tracker.states },
    channelLabelPrefix: tracker.channelLabelPrefix ?? DEFAULT_LINEAR_MAPPING.channelLabelPrefix,
    channelLabels: tracker.channelLabels ?? {},
  };
}

async function linearProblems(
  tracker: Profile["tracker"],
  env: CommandContext["env"],
  deps: DoctorDeps,
): Promise<string[]> {
  const result = await checkLinearConnection({
    apiKey: env["LINEAR_API_KEY"],
    team: tracker.team,
    mapping: linearMapping(tracker),
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
  });
  return result.ok ? [] : result.error.problems;
}

export async function runDoctor(
  ctx: CommandContext,
  deps: DoctorDeps = {},
): Promise<Envelope<unknown>> {
  if (ctx.dataDir === null) {
    return failure(
      "data-dir-not-found",
      `no data directory: pass --data, set JOBSHIP_HOME or run inside a directory with ${CONFIG_FILE}`,
      { recoveryAction: "run jobship init in an empty directory" },
    );
  }
  const loaded = loadProfileWithWarnings(ctx.dataDir);
  if (!loaded.ok) {
    return failure(loaded.error.code, loaded.error.message, {
      recoveryAction: "fix the named field in profile.yaml",
    });
  }
  const profile = { ok: true as const, value: loaded.value.profile };
  const badSources = unknownSources(profile.value);
  if (badSources.length > 0) {
    return failure("unknown-sources", `unknown Source names: ${badSources.join(", ")}`, {
      recoveryAction: `use only: ${Object.keys(registeredSources).join(", ")}`,
    });
  }
  const fileProblems = dataFileProblems(ctx.dataDir);
  if (fileProblems.length > 0) {
    return failure("data-file-invalid", fileProblems.join("; "), {
      recoveryAction: "fix or remove the named file",
    });
  }
  const markers = findMarkers(ctx.dataDir);
  if (markers.length > 0) {
    const listed = markers.map((hit) => `${hit.file}:${hit.line}`).join(", ");
    return failure("todo-markers", `${markers.length} ${MARKER} markers remain: ${listed}`, {
      recoveryAction: `replace each ${MARKER} marker with your own data`,
    });
  }
  const problems = cvDataProblems(ctx.dataDir);
  if (problems.length > 0) {
    return failure("cv-data-invalid", problems.join("; "), {
      recoveryAction: "fix facts.yaml, bullets.yaml and never-claim.yaml as named",
    });
  }
  const selfTest = runGuardSelfTest("guardHooks" in deps ? deps.guardHooks : SELF_TEST_HOOKS);
  if (!selfTest.pass) {
    const failed = selfTest.cases.filter((entry) => !entry.pass).map((entry) => entry.name);
    return failure("guard-self-test-failed", `guard self-test failed: ${failed.join("; ")}`, {
      recoveryAction: "run jobship guard --self-test and fix the named cases",
    });
  }
  if (profile.value.tracker.kind === "linear") {
    const linearIssues = await linearProblems(profile.value.tracker, ctx.env, deps);
    if (linearIssues.length > 0) {
      return failure("linear-not-ready", linearIssues.join("; "), {
        recoveryAction:
          "set LINEAR_API_KEY, tracker.team and tracker.states to match your Linear team",
      });
    }
  }
  const plugin = probePlugin(ctx.env);
  return success({
    guard: { selfTest: "pass", pluginInstalled: plugin.installed },
    warnings: [
      ...loaded.value.warnings.map((message) => ({
        code: "profile-unknown-field",
        message,
        recoveryAction: "remove the field from profile.yaml",
      })),
      ...atsWithoutCompanies(ctx.dataDir, profile.value),
      ...(plugin.warning === null ? [] : [plugin.warning]),
    ],
    dataDir: ctx.dataDir.path,
    tracker: profile.value.tracker.kind,
    sources: profile.value.sources.length,
    markers: 0,
    tools: toolStatus(ctx.env),
  });
}
