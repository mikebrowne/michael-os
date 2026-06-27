import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { loadConfig, requireOpenAiKey, requireCursorKey } from "../src/config/loadConfig.js";
import { createRunLogger } from "../src/logging/runLogger.js";
import { createRunDirectory } from "../src/agentBuild/runDir.js";
import { join } from "node:path";
import {
  createWorktree,
  installDependencies,
  captureGitDiff,
  listChangedFiles,
} from "../src/agentBuild/worktree.js";
import { generateSpecArtifacts, installAcceptanceTestInWorktree } from "../src/agentBuild/generateSpec.js";
import {
  runAcceptanceTest,
  saveAcceptanceHash,
  verifyAcceptanceHash,
  evaluateRedGreenGates,
  lockAcceptanceTest,
  unlockAcceptanceTest,
} from "../src/agentBuild/gates.js";
import { runPreflight } from "../src/agentBuild/preflight.js";
import { createCursorExecutor } from "../src/agentBuild/executor.js";
import { writeResult } from "../src/agentBuild/result.js";

function parseRequest(argv: string[]): string {
  const dashIndex = argv.indexOf("--");
  if (dashIndex >= 0) {
    const rest = argv.slice(dashIndex + 1).join(" ").trim();
    if (rest) return rest;
  }
  const positional = argv.find((a) => !a.startsWith("-"));
  if (positional) return positional.trim();
  throw new Error(
    'Usage: npm run agent:build -- "Your plain English build request"',
  );
}

async function main() {
  const request = parseRequest(process.argv.slice(2));
  const config = loadConfig();
  requireOpenAiKey(config);
  requireCursorKey(config);

  const runId = randomUUID();
  const runLogger = createRunLogger({
    logDir: config.logDir,
    logLevel: config.logLevel,
    name: config.appName,
  });

  const paths = createRunDirectory(config.aiRunsDir, request);
  let worktreeInfo: ReturnType<typeof createWorktree> | undefined;
  let cursorResult: import("../src/agentBuild/types.js").CodingExecutorResult = {
    started: false,
    status: "not_started",
    summary: "Cursor was not invoked.",
  };
  let gateOutcome = evaluateRedGreenGates(
    { passed: false, exitCode: 1, log: "RED gate not run." },
    { passed: false, exitCode: 1, log: "GREEN gate not run." },
    false,
  );
  let preflight = runPreflight(process.cwd());
  let changedFiles: string[] = [];
  let gitDiff = "";
  let specSummary = "Spec not generated.";
  let acceptanceHash = "";

  runLogger.log({
    runId,
    event: "agentBuild.start",
    data: { runDir: paths.runDir, requestLength: request.length },
  });

  try {
    console.log("Generating spec artifacts...");
    const spec = await generateSpecArtifacts(request, config.defaultModel, paths);
    specSummary = spec.specMd.split("\n").find((l) => l.startsWith("# Objective"))
      ? spec.specMd.slice(0, 500)
      : spec.specMd.slice(0, 500);

    runLogger.log({ runId, event: "agentBuild.spec", data: { runDir: paths.runDir } });

    console.log("Creating isolated worktree...");
    worktreeInfo = createWorktree(process.cwd(), paths.worktreePath, paths.slug);
    installAcceptanceTestInWorktree(
      paths.worktreePath,
      spec.acceptanceTestRelativePath,
      spec.acceptanceTestContent,
    );
    acceptanceHash = saveAcceptanceHash(
      join(paths.worktreePath, spec.acceptanceTestRelativePath),
      paths.acceptanceHashPath,
    );
    const acceptancePath = join(paths.worktreePath, spec.acceptanceTestRelativePath);
    lockAcceptanceTest(acceptancePath);

    console.log("Installing dependencies in worktree...");
    installDependencies(paths.worktreePath);

    console.log("Running RED gate...");
    const red = runAcceptanceTest(paths.worktreePath, spec.acceptanceTestRelativePath);
    writeFileSync(paths.redGateLogPath, red.log, "utf-8");
    runLogger.log({
      runId,
      event: "agentBuild.redGate",
      data: { passed: red.passed, expectedFail: !red.passed },
    });

    console.log("Invoking Cursor executor...");
    const executor = createCursorExecutor(config);
    try {
      cursorResult = await executor.runTask({
        repoPath: process.cwd(),
        worktreePath: paths.worktreePath,
        runDir: paths.runDir,
        specPath: paths.specPath,
        promptPath: paths.cursorTaskPath,
        acceptanceTestPath: acceptancePath,
      });
    } finally {
      unlockAcceptanceTest(acceptancePath);
    }
    runLogger.log({
      runId,
      event: "agentBuild.cursor",
      data: { status: cursorResult.status, runId: cursorResult.runId },
    });

    console.log("Running GREEN gate...");
    const green = runAcceptanceTest(paths.worktreePath, spec.acceptanceTestRelativePath);
    writeFileSync(paths.greenGateLogPath, green.log, "utf-8");
    const hashUnchanged = verifyAcceptanceHash(
      join(paths.worktreePath, spec.acceptanceTestRelativePath),
      acceptanceHash,
    );
    gateOutcome = evaluateRedGreenGates(red, green, hashUnchanged);
    runLogger.log({
      runId,
      event: "agentBuild.greenGate",
      data: {
        greenPassed: green.passed,
        hashUnchanged,
        valid: gateOutcome.greenGateValid,
      },
    });

    console.log("Running preflight...");
    preflight = runPreflight(paths.worktreePath);
    writeFileSync(paths.preflightLogPath, preflight.log, "utf-8");
    runLogger.log({
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
      // Keep worktree on disk for inspection; branch remains for operator review.
      console.log(`Worktree preserved at: ${paths.worktreePath}`);
    }
  }

  const { success } = writeResult({
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

  runLogger.log({
    runId,
    event: "agentBuild.complete",
    data: { success, runDir: paths.runDir },
  });

  console.log(`\nRun folder: ${paths.runDir}`);
  console.log(`Result: ${paths.resultPath}`);
  console.log(`Success: ${success}`);
  console.log(`Run logs: ${runLogger.getLogFilePath()}`);

  if (!success) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
