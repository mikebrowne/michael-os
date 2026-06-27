import { execSync } from "node:child_process";
import type { AppConfig } from "../config/loadConfig.js";
import type { WorkItem } from "./workItem.js";
import type { RunAgentBuildResult } from "../agentBuild/runAgentBuild.js";
import type { ApprovalState } from "./approvalGate.js";
import { createApprovalState } from "./approvalGate.js";
import type { GhRunner } from "./github.js";
import type { GitRunner } from "./ship.js";
import { createCodeReviewerAgent } from "../mastra/agents/code-reviewer.js";
import { createEngineeringTelemetry } from "./engineeringTelemetry.js";
import { createRunLogger } from "../logging/runLogger.js";
import type { ReviewVerdict } from "./review.js";
import type { Agent } from "@mastra/core/agent";
import type { EngineeringTelemetry } from "./engineeringTelemetry.js";

export type EngineeringSessionContext = {
  config: AppConfig;
  repoPath: string;
  githubRepo: string;
  approval: ApprovalState;
  currentWorkItem: WorkItem | null;
  lastBuildResult: RunAgentBuildResult | null;
  lastReviewVerdict: ReviewVerdict | null;
  codeReviewerAgent: Agent;
  telemetry: EngineeringTelemetry;
  ghRunner: GhRunner;
  gitRunner: GitRunner;
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
        stderr: err.stderr ?? "",
        exitCode: typeof err.status === "number" ? err.status : 1,
      };
    }
  });
}

function createDefaultGitRunner(cwd: string): GitRunner {
  return (args) => {
    try {
      const stdout = execSync(args.map((a) => JSON.stringify(a)).join(" "), {
        encoding: "utf-8",
        stdio: "pipe",
        cwd,
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        exitCode: typeof err.status === "number" ? err.status : 1,
      };
    }
  };
}

export function createEngineeringSessionContext(
  config: AppConfig,
  options?: {
    repoPath?: string;
    githubRepo?: string;
    ghRunner?: GhRunner;
    gitRunner?: GitRunner;
    codeReviewerAgent?: Agent;
    telemetry?: EngineeringTelemetry;
  },
): EngineeringSessionContext {
  const repoPath = options?.repoPath ?? process.cwd();
  const runLogger = createRunLogger({
    logDir: config.logDir,
    logLevel: config.logLevel,
    name: config.appName,
  });
  const telemetry = options?.telemetry ?? createEngineeringTelemetry(runLogger);
  telemetry.logRegistryLoaded();

  return {
    config,
    repoPath,
    githubRepo: options?.githubRepo ?? "mikebrowne/michael-os",
    approval: createApprovalState(),
    currentWorkItem: null,
    lastBuildResult: null,
    lastReviewVerdict: null,
    codeReviewerAgent:
      options?.codeReviewerAgent ??
      createCodeReviewerAgent(config.defaultReviewModel, repoPath),
    telemetry,
    ghRunner: options?.ghRunner ?? defaultGhRunner,
    gitRunner: options?.gitRunner ?? createDefaultGitRunner(repoPath),
  };
}
