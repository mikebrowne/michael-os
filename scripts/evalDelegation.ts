#!/usr/bin/env tsx
/**
 * Local-only north-star delegation eval.
 * Requires OPENAI_API_KEY in .env — not run in CI.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requireOpenAiKey } from "../src/config/loadConfig.js";
import { observabilityStore, jobRegistry } from "../src/mastra/index.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringTools } from "../src/mastra/tools/engineering/index.js";
import { config } from "../src/mastra/index.js";
import type { RunAgentBuildResult } from "../src/agentBuild/runAgentBuild.js";

async function main() {
  requireOpenAiKey(config);

  const dir = mkdtempSync(join(tmpdir(), "michael-os-eval-"));
  try {
    const evalConfig = {
      ...config,
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };

    const ctx = createEngineeringSessionContext(evalConfig, {
      observability: observabilityStore,
      jobRegistry,
    });

    ctx.currentWorkItem = {
      id: "eval-feature",
      slug: "eval-feature",
      title: "Eval feature",
      stage: "build",
      issueNumber: 9999,
      prdPath: join(dir, "eval.md"),
      acceptanceTestPath: join(dir, "eval.test.ts"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(ctx.currentWorkItem.prdPath!, "# Eval PRD\n");
    writeFileSync(ctx.currentWorkItem.acceptanceTestPath!, "test('eval',()=>{})");

    ctx.lastBuildResult = {
      success: true,
      runDir: dir,
      worktreePath: dir,
      gitDiff: "diff --git a/src/x.ts",
      changedFiles: ["src/x.ts"],
      acceptanceHash: "eval-hash",
      manifestPath: join(dir, "manifest.json"),
    } as RunAgentBuildResult;

    const tools = createEngineeringTools(ctx);
    await tools.reviewBuild.execute!({ slug: "eval-feature" }, {} as never);

    const delegated = await observabilityStore.queryByEvent("job.delegated");
    const completed = await observabilityStore.queryByEvent("job.completed");
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
