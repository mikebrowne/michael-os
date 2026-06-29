import { execSync } from "node:child_process";
import type { AppConfig } from "../config/loadConfig.js";
import type { ApprovalState } from "../engineering/approvalGate.js";
import { createApprovalState } from "../engineering/approvalGate.js";
import type { GhRunner } from "../engineering/github.js";
import { createObservabilityStore } from "../observability/observabilityStore.js";
import { createObservabilityConfig } from "../observability/observabilityConfig.js";
import { createSkillTelemetry, type SkillTelemetry } from "../skills/skillTelemetry.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";

export type SkillEngineerSessionContext = {
  config: AppConfig;
  repoPath: string;
  githubRepo: string;
  approval: ApprovalState;
  observability: ObservabilityStore;
  skillTelemetry: SkillTelemetry;
  ghRunner: GhRunner;
};

function defaultGhRunner(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return Promise.resolve().then(() => {
    try {
      const stdout = execSync(`gh ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? String(error),
        exitCode: err.status ?? 1,
      };
    }
  });
}

export function createSkillEngineerSessionContext(
  config: AppConfig,
  options: {
    repoPath?: string;
    observability?: ObservabilityStore;
    ghRunner?: GhRunner;
    githubRepo?: string;
  } = {},
): SkillEngineerSessionContext {
  const repoPath = options.repoPath ?? process.cwd();
  const observability =
    options.observability ??
    createObservabilityStore({
      logDir: config.logDir,
      mastraDir: config.mastraDir,
      config: createObservabilityConfig({ level: config.observabilityLevel }),
    });

  return {
    config,
    repoPath,
    githubRepo: options.githubRepo ?? "mikebrowne/michael-os",
    approval: createApprovalState(),
    observability,
    skillTelemetry: createSkillTelemetry(observability),
    ghRunner: options.ghRunner ?? defaultGhRunner,
  };
}
