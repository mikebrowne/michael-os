import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { reviewVerdictSchema } from "../src/engineering/review.js";

describe("jobRegistry", () => {
  it("creates and retrieves jobs with typed output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-jobs-"));
    try {
      const registry = createJobRegistry(dir);
      const job = await registry.createJob({
        kind: "code-review",
        parentWorkItem: "test-feature",
        issueNumber: 42,
        delegatedTo: "qa-engineer",
        input: { workItemSlug: "test-feature" },
        traceId: "trace-1",
      });
      expect(job.status).toBe("queued");

      const verdict = reviewVerdictSchema.parse({
        decision: "approve",
        rationale: "ok",
        findings: [],
      });
      const updated = await registry.updateJob(job.id, {
        status: "succeeded",
        output: verdict,
        completedAt: new Date().toISOString(),
      });
      expect(updated?.output).toEqual(verdict);

      const byWorkItem = await registry.listJobs({ parentWorkItem: "test-feature" });
      expect(byWorkItem).toHaveLength(1);
      expect(
        await registry.hasReviewJobForWorkItem("test-feature"),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
