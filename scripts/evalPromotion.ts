#!/usr/bin/env tsx
/**
 * Local-only Phase 5 promotion eval (bucket E).
 * Requires OPENAI_API_KEY — not run in CI. Uses fake git/gh runners (no network).
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createQaEngineerAgent } from "../src/mastra/agents/qa-engineer.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringTools } from "../src/mastra/tools/engineering/index.js";
import { createPromotionRegistry } from "../src/engineering/promotionRegistry.js";
import { upsertWorkItem } from "../src/engineering/workItem.js";
import type { GitRunner } from "../src/engineering/ship.js";
import type { GhRunner } from "../src/engineering/github.js";
import type { RunAgentBuildResult } from "../src/agentBuild/runAgentBuild.js";
import { grantApproval } from "../src/engineering/approvalGate.js";

function runShell(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    env: { ...process.env, GIT_TEMPLATE_DIR: "" },
  }).trim();
}

function setupBareRepo(dir: string) {
  const barePath = join(dir, "remote.git");
  const repoPath = join(dir, "work");
  runShell(`git init --bare "${barePath}"`, dir);
  const originUrl = `file://${barePath}`;
  runShell(`git clone "${originUrl}" work`, dir);
  runShell('git config user.email "eval@test.com"', repoPath);
  runShell('git config user.name "Eval"', repoPath);
  writeFileSync(join(repoPath, "README.md"), "# eval\n");
  runShell("git add . && git commit -m init", repoPath);
  runShell("git branch -M main && git push -u origin main", repoPath);
  return { repoPath, originUrl };
}

function createGitRunner(cwd: string): GitRunner {
  return (args) => {
    try {
      const stdout = execSync(args.map((a) => JSON.stringify(a)).join(" "), {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, GIT_TEMPLATE_DIR: "" },
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

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);

  const dir = mkdtempSync(join(tmpdir(), "michael-os-eval-promo-"));
  try {
    const evalConfig = {
      ...config,
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };

    const { repoPath } = setupBareRepo(dir);
    const worktreePath = join(dir, "worktree");
    mkdirSync(join(worktreePath, "docs"), { recursive: true });
    writeFileSync(
      join(worktreePath, "docs", "eval-clean.md"),
      "# Clean eval doc\nNo harness changes.\n",
    );
    writeFileSync(
      join(worktreePath, "package.json"),
      JSON.stringify({
        name: "eval-worktree",
        private: true,
        scripts: { typecheck: "true", lint: "true", test: "true", build: "true" },
      }),
    );

    const observability = createObservabilityStore({
      logDir: evalConfig.logDir,
      mastraDir: evalConfig.mastraDir,
      config: createObservabilityConfig({ level: evalConfig.observabilityLevel }),
    });
    const jobRegistry = createJobRegistry(evalConfig.mastraDir);
    const promotionRegistry = createPromotionRegistry(evalConfig.mastraDir);
    const jobRunner = createJobRunner({ jobRegistry, observability });
    const qaEngineerAgent = createQaEngineerAgent(
      evalConfig.defaultReviewModel,
      repoPath,
    );

    let prCounter = 0;
    const ghRunner: GhRunner = async (args) => {
      if (args[0] === "pr" && args[1] === "create") {
        prCounter += 1;
        return {
          stdout: `https://github.com/eval/repo/pull/${prCounter}`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (args[0] === "pr" && args[1] === "merge") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (args[0] === "pr" && args[1] === "checks") {
        return {
          stdout: JSON.stringify([{ name: "ci", state: "SUCCESS", conclusion: "success" }]),
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    const ctx = createEngineeringSessionContext(evalConfig, {
      observability,
      jobRegistry,
      jobRunner,
      promotionRegistry,
      qaEngineerAgent,
      repoPath,
      githubRepo: "eval/repo",
      gitRunner: createGitRunner(repoPath),
      ghRunner,
    });

    const prdPath = join(dir, "eval.md");
    const acceptancePath = join(dir, "eval.test.ts");
    writeFileSync(prdPath, "# Eval PRD\nAdd docs/eval-clean.md only.\n");
    writeFileSync(acceptancePath, "test('eval clean', () => {})");

    ctx.currentWorkItem = upsertWorkItem(evalConfig.stateDir, {
      id: "eval-clean-promote",
      slug: "eval-clean-promote",
      title: "Eval clean promote",
      stage: "build",
      issueNumber: 4242,
      prdPath,
      acceptanceTestPath: acceptancePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    ctx.lastBuildResult = {
      success: true,
      request: "eval clean promote",
      runId: "eval-promo-run",
      runDir: dir,
      resultPath: join(dir, "result.md"),
      worktreePath,
      gitDiff: "diff --git a/docs/eval-clean.md b/docs/eval-clean.md\n",
      changedFiles: ["docs/eval-clean.md"],
      acceptanceHash: "eval-promo-hash",
      manifestPath: join(dir, "manifest.json"),
      specSummary: "eval",
      markdown: "",
      gateOutcome: { redPassed: true, greenPassed: true, messages: [] },
      preflight: { ok: true, steps: [] },
      cursorResult: { started: true, status: "finished", summary: "eval" },
    } as unknown as RunAgentBuildResult;

    const tools = createEngineeringTools(ctx);

    const verify = (await tools.verifyBuild.execute!(
      { slug: "eval-clean-promote" },
      {} as never,
    )) as { overall?: string; message: string };

    if (verify.overall !== "pass") {
      throw new Error(`verify-build did not pass: ${verify.message}`);
    }

    grantApproval(ctx.approval, "stage-implementation");
    const staged = (await tools.stageImplementationTool.execute!(
      { commitMessage: "docs: eval clean" },
      {} as never,
    )) as { staged?: boolean; message: string };

    if (!staged.staged) {
      throw new Error(`stage failed: ${staged.message}`);
    }

    grantApproval(ctx.approval, "promote");
    const promoted = (await tools.promoteTool.execute!(
      { commitMessage: "docs: eval clean promote" },
      {} as never,
    )) as { promoted?: boolean; message: string; promotionNumber?: number };
    if (!promoted.promoted) {
      throw new Error(`promote failed: ${promoted.message}`);
    }

    const ledger = await promotionRegistry.listPromotions();
    const gateEvents = await observability.queryByEvent("gate.result");

    const passed =
      ledger.length === 1 &&
      ledger[0]?.status === "promoted" &&
      gateEvents.length >= 1;

    console.log(
      JSON.stringify(
        {
          passed,
          promotionNumber: promoted.promotionNumber,
          ledgerCount: ledger.length,
          gateEvents: gateEvents.length,
        },
        null,
        2,
      ),
    );

    if (!passed) process.exit(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
