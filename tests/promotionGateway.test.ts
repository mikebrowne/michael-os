import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import { loadConfig } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createGatewayMemorySession } from "../src/engineering/gatewaySession.js";
import {
  createGatewayRuntime,
  processGatewayLine,
} from "../src/gateway/session.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { createPromotionRegistry } from "../src/engineering/promotionRegistry.js";
import { requestApproval } from "../src/engineering/approvalGate.js";

function createMockAgent(): Agent {
  return {
    id: "engineering-lead",
    generate: async () => ({ text: "mock response" }),
  } as unknown as Agent;
}

function createMockMemory(): Memory {
  return {
    getThreadById: async () => null,
    saveThread: async () => {},
    saveMessages: async () => {},
    updateWorkingMemory: async () => {},
  } as unknown as Memory;
}

describe("promotion gateway commands", () => {
  async function createRuntime() {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-promo-gw-"));
    const config = {
      ...loadConfig(),
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };
    const observability = createObservabilityStore({
      logDir: config.logDir,
      mastraDir: config.mastraDir,
      config: createObservabilityConfig({ level: "minimal" }),
    });
    const jobRegistry = createJobRegistry(config.mastraDir);
    const jobRunner = createJobRunner({ jobRegistry, observability });
    const promotionRegistry = createPromotionRegistry(config.mastraDir);
    const ctx = createEngineeringSessionContext(config, {
      observability,
      jobRegistry,
      jobRunner,
      promotionRegistry,
      repoPath: process.cwd(),
      qaEngineerAgent: createMockAgent(),
      gitRunner: () => ({ stdout: "abc123\n", stderr: "", exitCode: 0 }),
      ghRunner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });
    const runtime = await createGatewayRuntime({
      config,
      ctx,
      agent: createMockAgent(),
      memory: createMockMemory(),
      memorySession: createGatewayMemorySession(),
    });
    return { dir, promotionRegistry, runtime };
  }

  it("promotions lists promotion ledger entries", async () => {
    const { dir, promotionRegistry, runtime } = await createRuntime();
    try {
      await promotionRegistry.createPromotion({
        commitSha: "sha111",
        parentWorkItem: "feat-a",
        prNumber: 1,
        branchName: "feature/feat-a-111",
        issueNumber: 10,
      });

      const result = await processGatewayLine(runtime, "promotions");
      const text = result.output.join("");
      expect(text).toContain("Promotions:");
      expect(text).toContain("#1");
      expect(text).toContain("feat-a");
    } finally {
      await promotionRegistry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("promotion #N shows promotion detail", async () => {
    const { dir, promotionRegistry, runtime } = await createRuntime();
    try {
      const record = await promotionRegistry.createPromotion({
        commitSha: "deadbeef",
        parentWorkItem: "feat-b",
        prNumber: 2,
        branchName: "feature/feat-b-222",
      });

      const result = await processGatewayLine(
        runtime,
        `promotion #${record.promotionNumber}`,
      );
      const text = result.output.join("");
      expect(text).toContain("Promotion #1");
      expect(text).toContain("deadbeef");
      expect(text).toContain("feat-b");
    } finally {
      await promotionRegistry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rollback #N requests approval before executing", async () => {
    const { dir, promotionRegistry, runtime } = await createRuntime();
    try {
      await promotionRegistry.createPromotion({
        commitSha: "cafebabe",
        parentWorkItem: "feat-c",
        prNumber: 3,
        branchName: "feature/feat-c-333",
      });

      const result = await processGatewayLine(runtime, "rollback #1");
      const text = result.output.join("");
      expect(text).toMatch(/rollback.*approval/i);
      expect(runtime.ctx.approval.pending?.toolId).toBe("rollback");
    } finally {
      await promotionRegistry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("no park routes promotion denial to parked state", async () => {
    const { dir, promotionRegistry, runtime } = await createRuntime();
    try {
      const { upsertWorkItem, createWorkItem } = await import(
        "../src/engineering/workItem.js"
      );
      runtime.ctx.currentWorkItem = upsertWorkItem(runtime.config.stateDir, {
        ...createWorkItem("feat-park-gw"),
        stage: "staged",
        issueNumber: 77,
        stagedPrNumber: 9,
        stagedBranchName: "feature/feat-park-gw-abc",
      });
      requestApproval(runtime.ctx.approval, "promote", {
        commitMessage: "feat: park test",
      });

      const result = await processGatewayLine(runtime, "no park");
      const text = result.output.join("");
      expect(text).toMatch(/park/i);
      expect(runtime.ctx.currentWorkItem?.stage).toBe("parked");
      expect(runtime.ctx.approval.pending).toBeUndefined();
    } finally {
      await promotionRegistry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
