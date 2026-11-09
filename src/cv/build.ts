import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeAtomic } from "../core/fs.ts";
import { errorMessage } from "../core/narrow.ts";
import type { DataDir, Result } from "../core/types.ts";
import { loadBullets, loadFactBank } from "./facts.ts";
import { selectBullets } from "./select.ts";

export type CompileRequest = {
  readonly root: string;
  readonly template: string;
  readonly dataFile: string;
  readonly output: string;
};

export type TypstRunner = {
  compile(request: CompileRequest): Promise<Result<void>>;
  extractText(pdf: string): Promise<Result<string>>;
};

export type BuildOptions = {
  readonly name?: string;
  readonly tags?: string[];
  readonly requirements?: string[];
  readonly template?: string;
  readonly runner?: TypstRunner;
};

export const CV_DIRECTORY = "cv";
export const CV_OUTPUT_DIRECTORY = "out";
export const DEFAULT_TEMPLATE = "template.typ";

async function runProcess(command: string[]): Promise<Result<string>> {
  try {
    const processHandle = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(processHandle.stdout).text(),
      new Response(processHandle.stderr).text(),
      processHandle.exited,
    ]);
    if (exitCode !== 0) {
      return {
        ok: false,
        error: { code: "cv-tool-failed", message: `${command[0]} exited ${exitCode}: ${stderr.trim()}` },
      };
    }
    return { ok: true, value: stdout };
  } catch (error) {
    return {
      ok: false,
      error: { code: "cv-tool-missing", message: `could not run ${command[0]}: ${errorMessage(error)}` },
    };
  }
}

export const systemRunner: TypstRunner = {
  async compile(request) {
    const dataInput = path.relative(request.root, request.dataFile);
    const result = await runProcess([
      "typst",
      "compile",
      "--root",
      request.root,
      "--input",
      `data=${dataInput}`,
      request.template,
      request.output,
    ]);
    return result.ok ? { ok: true, value: undefined } : result;
  },
  extractText(pdf) {
    return runProcess(["pdftotext", "-layout", pdf, "-"]);
  },
};

const VARIANT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isSafeVariantName(name: string): boolean {
  return VARIANT_NAME_PATTERN.test(name) && !name.includes("..");
}

export function outputPaths(dir: DataDir, name: string): { pdf: string; text: string; data: string } {
  const base = path.join(dir.path, CV_DIRECTORY, CV_OUTPUT_DIRECTORY, name);
  return { pdf: `${base}.pdf`, text: `${base}.txt`, data: `${base}.json` };
}

export async function buildCv(
  dir: DataDir,
  options: BuildOptions,
): Promise<Result<{ pdf: string; text: string }>> {
  const facts = loadFactBank(dir);
  if (!facts.ok) return facts;
  const bullets = loadBullets(dir);
  if (!bullets.ok) return bullets;

  const selected = selectBullets(bullets.value, {
    ...(options.tags === undefined ? {} : { tags: options.tags }),
    ...(options.requirements === undefined ? {} : { requirements: options.requirements }),
  });
  if (selected.length === 0) {
    return { ok: false, error: { code: "cv-empty", message: "no Bullet matches the selection" } };
  }

  const knownFactIds = new Set(facts.value.facts.map((fact) => fact.id));
  for (const bullet of selected) {
    const missing = bullet.factIds.filter((factId) => !knownFactIds.has(factId));
    if (bullet.factIds.length === 0) {
      return {
        ok: false,
        error: { code: "bullet-unbacked", message: `Bullet ${bullet.id} cites no fact id` },
      };
    }
    if (missing.length > 0) {
      return {
        ok: false,
        error: {
          code: "bullet-fact-missing",
          message: `Bullet ${bullet.id} references fact id ${missing.join(", ")} missing from the Fact bank`,
        },
      };
    }
  }

  const template = options.template ?? path.join(dir.path, CV_DIRECTORY, DEFAULT_TEMPLATE);
  if (!existsSync(template)) {
    return { ok: false, error: { code: "cv-template-missing", message: `no Typst template at ${template}` } };
  }

  const name = options.name ?? "cv";
  if (!isSafeVariantName(name)) {
    return {
      ok: false,
      error: { code: "invalid-variant", message: `variant name "${name}" must match ${VARIANT_NAME_PATTERN}` },
    };
  }
  const paths = outputPaths(dir, name);
  const payload = {
    variant: name,
    bullets: selected.map((bullet) => ({ id: bullet.id, text: bullet.text, tags: bullet.tags })),
  };
  const runner = options.runner ?? systemRunner;
  try {
    writeAtomic(paths.data, `${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    return { ok: false, error: { code: "cv-write-failed", message: errorMessage(error) } };
  }

  const compiled = await runner.compile({
    root: path.join(dir.path, CV_DIRECTORY),
    template,
    dataFile: paths.data,
    output: paths.pdf,
  });
  if (!compiled.ok) return compiled;
  const extracted = await runner.extractText(paths.pdf);
  if (!extracted.ok) return extracted;
  try {
    writeAtomic(paths.text, extracted.value);
  } catch (error) {
    return { ok: false, error: { code: "cv-write-failed", message: errorMessage(error) } };
  }
  return { ok: true, value: { pdf: paths.pdf, text: paths.text } };
}

export function readCvText(file: string): Result<string> {
  try {
    return { ok: true, value: readFileSync(file, "utf8") };
  } catch (error) {
    return { ok: false, error: { code: "cv-text-missing", message: `cannot read ${file}: ${errorMessage(error)}` } };
  }
}
