import { failure, success, type Envelope } from "./envelope.ts";
import {
  ensureTypst,
  systemInstallDeps,
  toolStatus,
  type InstallDeps,
  type PlatformInfo,
  type ToolEnv,
} from "./tools.ts";

export async function runSetup(
  env: ToolEnv,
  deps: InstallDeps = systemInstallDeps(),
  platform: PlatformInfo = deps.platform,
): Promise<Envelope<unknown>> {
  const typst = await ensureTypst(env, deps);
  if (!typst.ok) {
    return failure("cv-tool-missing", typst.error.message, {
      recoveryAction: "install typst with mise, cargo or brew, then rerun jobship setup",
    });
  }
  const status = toolStatus(env, platform);
  if (!status.pdftotext.found) {
    return failure(
      "cv-tool-missing",
      `typst is ready at ${typst.value} but pdftotext (poppler) is missing`,
      { recoveryAction: `run: ${status.pdftotext.installHint}` },
    );
  }
  return success(status);
}
