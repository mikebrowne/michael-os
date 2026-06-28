#!/usr/bin/env tsx
/**
 * Local-only north-star delegation eval.
 * Requires OPENAI_API_KEY in .env — not run in CI.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createCodeReviewerAgent } from "../src/mastra/agents/code-reviewer.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringTools } from "../src/mastra/tools/engineering/index.js";
import { upsertWorkItem } from "../src/engineering/workItem.js";
import type { RunAgentBuildResult } from "../src/agentBuild/runAgentBuild.js";

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);

  const dir = mkdtempSync(join(tmpdir(), "michael-os-eval-"));
  try {
    const evalConfig = {
      ...config,
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };

    const observability = createObservabilityStore({
      logDir: evalConfig.logDir,
      mastraDir: evalConfig.mastraDir,
      config: createObservabilityConfig({ level: evalConfig.observabilityLevel }),
    });
    const jobRegistry = createJobRegistry(evalConfig.mastraDir);
    const jobRunner = createJobRunner({ jobRegistry, observability });
    const codeReviewerAgent = createCodeReviewerAgent(
      evalConfig.defaultReviewModel,
      process.cwd(),
    );

    const ctx = createEngineeringSessionContext(evalConfig, {
      observability,
      jobRegistry,
      jobRunner,
      codeReviewerAgent,
    });

    const workItem = {
      id: "eval-feature",
      slug: "eval-feature",
      title: "Eval feature",
      stage: "build" as const,
      issueNumber: 9999,
      prdPath: join(dir, "eval.md"),
      acceptanceTestPath: join(dir, "eval.test.ts"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(workItem.prdPath, "# Eval PRD\n");
    writeFileSync(workItem.acceptanceTestPath, "test('eval',()=>{})");
    ctx.currentWorkItem = upsertWorkItem(evalConfig.stateDir, workItem);

    ctx.lastBuildResult = {
      success: true,
      request: "eval feature build",
      runId: "eval-run-1",
      runDir: dir,
      resultPath: join(dir, "result.md"),
      worktreePath: dir,
      gitDiff: "diff --git a/src/x.ts",
      changedFiles: ["src/x.ts"],
      acceptanceHash: "eval-hash",
      manifestPath: join(dir, "manifest.json"),
      specSummary: "eval",
      markdown: "",
      gateOutcome: { redPassed: true, greenPassed: true, messages: [] },
      preflight: { ok: true, steps: [] },
      cursorResult: {
        started: true,
        status: "finished",
        summary: "eval",
      },
    } as unknown as RunAgentBuildResult;

    const tools = createEngineeringTools(ctx);
    await tools.reviewBuild.execute!({ slug: "eval-feature" }, {} as never);

    const delegated = await observability.queryByEvent("job.delegated");
    const completed = await observability.queryByEvent("job.completed");
    const jobs = await jobRegistry.listJobs({ parentWorkItem: "eval-feature" });

    const passed =
      jobs.length >= 1 &&
      delegated.length >= 1 &&
      completed.length >= 1 &&
      jobs[0]?.status === "succeeded";

    console.log(
      JSON.stringify(
        {
          passed,
          jobs: jobs.length,
          delegatedEvents: delegated.length,
          completedEvents: completed.length,
        },
        null,
        2,
      ),
    );

    if (!passed) {
      process.exit(1);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
