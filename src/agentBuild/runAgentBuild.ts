import { randomUUID } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "../config/loadConfig.js";
import type { RunLogger } from "../logging/runLogger.js";
import { createRunDirectory } from "./runDir.js";
import {
  createWorktree,
  installDependencies,
  captureGitDiff,
  listChangedFiles,
} from "./worktree.js";
import {
  generateSpecArtifacts,
  installAcceptanceTestInWorktree,
  normalizeAcceptanceImports,
} from "./generateSpec.js";
import {
  runAcceptanceTest,
  saveAcceptanceHash,
  verifyAcceptanceHash,
  evaluateRedGreenGates,
  lockAcceptanceTest,
  unlockAcceptanceTest,
} from "./gates.js";
import { runPreflight } from "./preflight.js";
import { createCursorExecutor } from "./executor.js";
import { writeResult } from "./result.js";
import type { CodingExecutorResult, PreflightResult } from "./types.js";
import type { RedGreenGateOutcome } from "./gates.js";
import { execSync } from "node:child_process";
import {
  writeBuildManifest,
  type BuildManifest,
} from "../engineering/buildManifest.js";

export type SuppliedBuildSpec = {
  specMd: string;
  cursorTaskMd: string;
  acceptanceTestRelativePath: string;
  acceptanceTestContent: string;
};

export type RunAgentBuildOptions = {
  request: string;
  config: AppConfig;
  repoPath?: string;
  runId?: string;
  runLogger?: RunLogger;
  suppliedSpec?: SuppliedBuildSpec;
  onProgress?: (message: string) => void;
};

export type RunAgentBuildResult = {
  runId: string;
  runDir: string;
  resultPath: string;
  worktreePath: string;
  success: boolean;
  request: string;
  specSummary: string;
  cursorResult: CodingExecutorResult;
  gateOutcome: RedGreenGateOutcome;
  preflight: PreflightResult;
  changedFiles: string[];
  gitDiff: string;
  markdown: string;
  manifestPath?: string;
  acceptanceHash?: string;
};

const DEFAULT_ACCEPTANCE_PATH = "tests/acceptance/agent-build.test.ts";

function progress(onProgress: RunAgentBuildOptions["onProgress"], message: string) {
  onProgress?.(message);
}

function writeSuppliedSpecArtifacts(
  paths: ReturnType<typeof createRunDirectory>,
  supplied: SuppliedBuildSpec,
): void {
  const acceptanceContent = normalizeAcceptanceImports(
    supplied.acceptanceTestContent,
  );
  writeFileSync(paths.specPath, `${supplied.specMd.trim()}\n`, "utf-8");
  writeFileSync(paths.cursorTaskPath, `${supplied.cursorTaskMd.trim()}\n`, "utf-8");
  writeFileSync(paths.acceptanceTestPath, `${acceptanceContent.trim()}\n`, "utf-8");
}

export async function runAgentBuild(
  options: RunAgentBuildOptions,
): Promise<RunAgentBuildResult> {
  const {
    request,
    config,
    repoPath = process.cwd(),
    runLogger,
    suppliedSpec,
    onProgress,
  } = options;
  const runId = options.runId ?? randomUUID();

  const paths = createRunDirectory(config.aiRunsDir, request);
  let worktreeInfo: ReturnType<typeof createWorktree> | undefined;
  let cursorResult: CodingExecutorResult = {
    started: false,
    status: "not_started",
    summary: "Cursor was not invoked.",
  };
  let gateOutcome = evaluateRedGreenGates(
    { passed: false, exitCode: 1, log: "RED gate not run." },
    { passed: false, exitCode: 1, log: "GREEN gate not run." },
    false,
  );
  let preflight = runPreflight(repoPath);
  let changedFiles: string[] = [];
  let gitDiff = "";
  let specSummary = "Spec not generated.";
  let acceptanceHash = "";
  let acceptanceRelativePath = DEFAULT_ACCEPTANCE_PATH;
  let baseCommit = "";

  runLogger?.log({
    runId,
    event: "agentBuild.start",
    data: { runDir: paths.runDir, requestLength: request.length, suppliedSpec: !!suppliedSpec },
  });

  try {
    if (suppliedSpec) {
      progress(onProgress, "Installing supplied spec artifacts...");
      writeSuppliedSpecArtifacts(paths, suppliedSpec);
      specSummary = suppliedSpec.specMd.slice(0, 500);
      acceptanceRelativePath = suppliedSpec.acceptanceTestRelativePath;
    } else {
      progress(onProgress, "Generating spec artifacts...");
      const spec = await generateSpecArtifacts(request, config.defaultModel, paths);
      specSummary = spec.specMd.slice(0, 500);
      acceptanceRelativePath = spec.acceptanceTestRelativePath;
    }

    runLogger?.log({ runId, event: "agentBuild.spec", data: { runDir: paths.runDir } });

    baseCommit = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
    }).trim();

    progress(onProgress, "Creating isolated worktree...");
    worktreeInfo = createWorktree(repoPath, paths.worktreePath, paths.slug);

    const acceptanceContent = suppliedSpec
      ? normalizeAcceptanceImports(suppliedSpec.acceptanceTestContent)
      : readFileSync(paths.acceptanceTestPath, "utf-8");

    installAcceptanceTestInWorktree(
      paths.worktreePath,
      acceptanceRelativePath,
      acceptanceContent,
    );

    acceptanceHash = saveAcceptanceHash(
      join(paths.worktreePath, acceptanceRelativePath),
      paths.acceptanceHashPath,
    );
    const acceptancePath = join(paths.worktreePath, acceptanceRelativePath);
    lockAcceptanceTest(acceptancePath);

    progress(onProgress, "Installing dependencies in worktree...");
    installDependencies(paths.worktreePath);

    progress(onProgress, "Running RED gate...");
    const red = runAcceptanceTest(paths.worktreePath, acceptanceRelativePath);
    writeFileSync(paths.redGateLogPath, red.log, "utf-8");
    runLogger?.log({
      runId,
      event: "agentBuild.redGate",
      data: { passed: red.passed, expectedFail: !red.passed },
    });

    progress(onProgress, "Invoking Cursor executor...");
    const executor = createCursorExecutor(config);
    try {
      cursorResult = await executor.runTask({
        repoPath,
        worktreePath: paths.worktreePath,
        runDir: paths.runDir,
        specPath: paths.specPath,
        promptPath: paths.cursorTaskPath,
        acceptanceTestPath: acceptancePath,
      });
    } finally {
      unlockAcceptanceTest(acceptancePath);
    }
    runLogger?.log({
      runId,
      event: "agentBuild.cursor",
      data: { status: cursorResult.status, runId: cursorResult.runId },
    });

    progress(onProgress, "Running GREEN gate...");
    const green = runAcceptanceTest(paths.worktreePath, acceptanceRelativePath);
    writeFileSync(paths.greenGateLogPath, green.log, "utf-8");
    const hashUnchanged = verifyAcceptanceHash(
      join(paths.worktreePath, acceptanceRelativePath),
      acceptanceHash,
    );
    gateOutcome = evaluateRedGreenGates(red, green, hashUnchanged);
    runLogger?.log({
      runId,
      event: "agentBuild.greenGate",
      data: {
        greenPassed: green.passed,
        hashUnchanged,
        valid: gateOutcome.greenGateValid,
      },
    });

    progress(onProgress, "Running preflight...");
    preflight = runPreflight(paths.worktreePath);
    writeFileSync(paths.preflightLogPath, preflight.log, "utf-8");
    runLogger?.log({
      runId,
      event: "agentBuild.preflight",
      data: { passed: preflight.passed },
    });

    gitDiff = captureGitDiff(paths.worktreePath);
    changedFiles = listChangedFiles(paths.worktreePath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    cursorResult = {
      started: false,
      status: "not_started",
      summary: `Build pipeline error: ${message}`,
      startupError: message,
    };
  } finally {
    if (worktreeInfo) {
      progress(onProgress, `Worktree preserved at: ${paths.worktreePath}`);
    }
  }

  const { success, markdown } = writeResult({
    request,
    runDir: paths.runDir,
    resultPath: paths.resultPath,
    diffPath: paths.diffPath,
    gitDiff,
    changedFiles,
    cursorResult,
    gateOutcome,
    preflight,
    specSummary,
    worktreePath: paths.worktreePath,
  });

  const manifest: BuildManifest = {
    runId,
    worktreePath: paths.worktreePath,
    success,
    acceptanceHash,
    acceptanceRelativePath,
    baseCommit,
    changedFiles,
    createdAt: new Date().toISOString(),
    request,
    runDir: paths.runDir,
  };
  const manifestPath = writeBuildManifest(paths.runDir, manifest);

  runLogger?.log({
    runId,
    event: "agentBuild.complete",
    data: { success, runDir: paths.runDir },
  });

  return {
    runId,
    runDir: paths.runDir,
    resultPath: paths.resultPath,
    worktreePath: paths.worktreePath,
    success,
    request,
    specSummary,
    cursorResult,
    gateOutcome,
    preflight,
    changedFiles,
    gitDiff,
    markdown,
    manifestPath,
    acceptanceHash,
  };
}

export function isBuildGreen(result: RunAgentBuildResult): boolean {
  return result.success;
}
