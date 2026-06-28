import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Agent } from "@mastra/core/agent";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringTools } from "../src/mastra/tools/engineering/index.js";
import { loadConfig } from "../src/config/loadConfig.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { upsertWorkItem } from "../src/engineering/workItem.js";
import type { RunAgentBuildResult } from "../src/agentBuild/runAgentBuild.js";

function createMockReviewerAgent(): Agent {
  return {
    id: "code-reviewer",
    generate: vi.fn(async () => ({
      object: {
        decision: "approve",
        rationale: "Controlled test verdict",
        findings: [],
      },
      text: "",
    })),
  } as unknown as Agent;
}

describe("delegation machinery", () => {
  it("review-build creates a job record via jobRunner", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-deleg-"));
    const config = {
      ...loadConfig(),
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };
    try {
      const observability = createObservabilityStore({
        logDir: config.logDir,
        mastraDir: config.mastraDir,
        config: createObservabilityConfig({ level: "standard" }),
      });
      const jobRegistry = createJobRegistry(config.mastraDir);
      const jobRunner = createJobRunner({ jobRegistry, observability });

      const ctx = createEngineeringSessionContext(config, {
        jobRegistry,
        jobRunner,
        observability,
        codeReviewerAgent: createMockReviewerAgent(),
      });

      ctx.currentWorkItem = {
        id: "feat",
        slug: "feat",
        title: "Feat",
        stage: "build",
        prdPath: join(dir, "feat.md"),
        acceptanceTestPath: join(dir, "feat.test.ts"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      writeFileSync(ctx.currentWorkItem.prdPath!, "# PRD\n");
      writeFileSync(ctx.currentWorkItem.acceptanceTestPath!, "test('x',()=>{})");
      upsertWorkItem(config.stateDir, ctx.currentWorkItem);

      ctx.lastBuildResult = {
        success: true,
        request: "eval feature build",
        runId: "run-1",
        runDir: dir,
        resultPath: join(dir, "result.md"),
        worktreePath: dir,
        gitDiff: "diff",
        changedFiles: ["src/x.ts"],
        acceptanceHash: "abc",
        manifestPath: join(dir, "manifest.json"),
        specSummary: "summary",
        markdown: "",
        gateOutcome: { redPassed: true, greenPassed: true, messages: [] },
        preflight: { ok: true, steps: [] },
        cursorResult: {
          success: true,
          agentId: "test",
          conversationUrl: "",
          summary: "",
          filesChanged: [],
        },
      } as unknown as RunAgentBuildResult;

      const tools = createEngineeringTools(ctx);
      const result = (await tools.reviewBuild.execute!(
        { slug: "feat" },
        {} as never,
      )) as { decision: string };

      expect(result.decision).toBe("approve");
      const jobs = await jobRegistry.listJobs({ parentWorkItem: "feat" });
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.kind).toBe("code-review");
      expect(jobs[0]?.status).toBe("succeeded");

      const events = await observability.queryByEvent("job.delegated");
      expect(events.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits review.missing via observability", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-missing-"));
    const config = {
      ...loadConfig(),
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };
    try {
      const observability = createObservabilityStore({
        logDir: config.logDir,
        mastraDir: config.mastraDir,
        config: createObservabilityConfig({ level: "standard" }),
      });
      const ctx = createEngineeringSessionContext(config, {
        observability,
        jobRegistry: createJobRegistry(config.mastraDir),
      });

      ctx.telemetry.logReviewMissing("feat", 42);
      const events = await observability.queryByEvent("review.missing");
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.correlation.workItemSlug).toBe("feat");
      expect(events[0]?.correlation.issueNumber).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
