import { checkThreshold, COVERAGE_LIMITS } from "./check-threshold.ts";

/**
 * Runs `bun test` with any extra arguments, mirrors its output, then gates coverage on a full
 * run. A filtered run measures only part of the suite, so it skips the gate.
 */
async function main(): Promise<number> {
  const extraArguments = process.argv.slice(2);
  const testRun = Bun.spawn(["bun", "test", ...extraArguments], {
    stdout: "inherit",
    stderr: "pipe",
    stdin: "inherit",
  });
  let output = "";
  const decoder = new TextDecoder();
  for await (const chunk of testRun.stderr) {
    process.stderr.write(chunk);
    output += decoder.decode(chunk, { stream: true });
  }
  const exitCode = await testRun.exited;
  if (exitCode !== 0 || extraArguments.length > 0) return exitCode;
  const result = checkThreshold(output, COVERAGE_LIMITS);
  for (const failure of result.failures) console.error(failure);
  return result.ok ? 0 : 1;
}

process.exit(await main());
