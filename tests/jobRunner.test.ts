import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import {
  createJobRunner,
  jobNotificationBus,
  type JobCompletionEvent,
} from "../src/engineering/jobRunner.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

describe("jobRunner", () => {
  function createFixture() {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-runner-"));
    const observability = createObservabilityStore({
      logDir: join(dir, "logs"),
      mastraDir: join(dir, ".mastra"),
      config: createObservabilityConfig({ level: "standard" }),
    });
    const registry = createJobRegistry(join(dir, ".mastra"));
    const runner = createJobRunner({ jobRegistry: registry, observability });
    return { dir, observability, registry, runner };
  }

  it("runs code review job and emits lifecycle", async () => {
    const { dir, observability, registry, runner } = createFixture();
    try {
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
      expect(job?.status).not.toBe("queued");
      expect(TERMINAL_STATUSES.has(job?.status ?? "")).toBe(true);
      expect(job?.startedAt).toBeTruthy();
      expect(job?.completedAt).toBeTruthy();

      const delegated = await observability.queryByEvent("job.delegated");
      const started = await observability.queryByEvent("job.started");
      const completed = await observability.queryByEvent("job.completed");
      expect(delegated.some((e) => e.correlation.jobId === result.jobId)).toBe(
        true,
      );
      expect(started.some((e) => e.correlation.jobId === result.jobId)).toBe(
        true,
      );
      expect(
        completed.some((e) => e.correlation.jobId === result.jobId),
      ).toBe(true);

      await observability.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never leaves job stuck in queued after runCodeReviewJob", async () => {
    const { dir, registry, runner } = createFixture();
    try {
      const result = await runner.runCodeReviewJob({
        parentWorkItem: "feat",
        input: { workItemSlug: "feat" },
        executeReview: async () => ({
          decision: "approve",
          rationale: "ok",
          findings: [],
        }),
      });

      const job = await registry.getJob(result.jobId);
      expect(job?.status).not.toBe("queued");
      expect(TERMINAL_STATUSES.has(job?.status ?? "")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks job failed and emits lifecycle when executeReview throws", async () => {
    const { dir, observability, registry, runner } = createFixture();
    try {
      const headlines: JobCompletionEvent[] = [];
      const onComplete = (event: JobCompletionEvent) => headlines.push(event);
      jobNotificationBus.on("job.completed", onComplete);

      await expect(
        runner.runCodeReviewJob({
          parentWorkItem: "feat",
          issueNumber: 3,
          input: { workItemSlug: "feat" },
          executeReview: async () => {
            throw new Error("review exploded");
          },
        }),
      ).rejects.toThrow("review exploded");

      const jobs = await registry.listJobs({ parentWorkItem: "feat" });
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.status).toBe("failed");
      expect(jobs[0]?.error).toBe("review exploded");

      const failedEvents = await observability.queryByEvent("job.failed");
      expect(failedEvents.length).toBeGreaterThan(0);

      expect(headlines).toHaveLength(1);
      expect(headlines[0]?.status).toBe("failed");
      expect(headlines[0]?.headline).toContain("code-review");

      jobNotificationBus.off("job.completed", onComplete);
      await observability.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
