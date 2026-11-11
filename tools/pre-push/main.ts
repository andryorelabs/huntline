import { checkPush, parsePushedRefs } from "./pre-push-check.ts";

const verdict = checkPush(parsePushedRefs(await Bun.stdin.text()));

if (!verdict.ok) {
  process.stderr.write(`pre-push: ${verdict.reason}\n`);
  process.exit(1);
}

if (verdict.runTypecheck) {
  const result = Bun.spawnSync(["bun", "run", "typecheck"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(result.exitCode ?? 1);
}
