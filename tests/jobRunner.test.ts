import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";

describe("jobRunner", () => {
  it("runs code review job and emits lifecycle", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-runner-"));
    try {
      const observability = createObservabilityStore({
        logDir: join(dir, "logs"),
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "standard" }),
      });
      const registry = createJobRegistry(join(dir, ".mastra"));
      const runner = createJobRunner({ jobRegistry: registry, observability });

      const result = await runner.runCodeReviewJob({
        parentWorkItem: "feat",
        issueNumber: 7,
        input: { workItemSlug: "feat" },
        executeReview: async () => ({
          decision: "approve",
          rationale: "test",
          findings: [],
        }),
      });

      expect(result.verdict.decision).toBe("approve");
      const job = await registry.getJob(result.jobId);
      expect(job?.status).toBe("succeeded");

      const events = await observability.queryByEvent("job.completed");
      expect(
        events.some((e) => e.correlation.jobId === result.jobId),
      ).toBe(true);
      await observability.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
