import { describe, expect, it } from "vitest";
import { processGatewayLine } from "../src/gateway/session.js";
import { createPromotionRegistry } from "../src/engineering/promotionRegistry.js";
import { requestApproval } from "../src/engineering/approvalGate.js";
import {
  cleanupTestGateway,
  createTestGatewayRuntime,
} from "./gatewayTestHarness.js";

describe("promotion gateway commands", () => {
  async function createRuntime(options?: {
    ghRunner?: () => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  }) {
    const harness = await createTestGatewayRuntime({
      extraCtx: {
        ghRunner:
          options?.ghRunner ??
          (async () => ({ stdout: "", stderr: "", exitCode: 0 })),
        gitRunner: () => ({ stdout: "abc123\n", stderr: "", exitCode: 0 }),
      },
    });
    const promotionRegistry = createPromotionRegistry(harness.config.mastraDir);
    harness.ctx.promotionRegistry = promotionRegistry;
    return { ...harness, promotionRegistry };
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
      cleanupTestGateway(dir);
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
      cleanupTestGateway(dir);
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
      cleanupTestGateway(dir);
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
      cleanupTestGateway(dir);
    }
  });
});
