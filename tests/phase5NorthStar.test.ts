import { describe, expect, it } from "vitest";
import type { WorkItemStage } from "../src/engineering/workItem.js";
import { DANGEROUS_TOOL_IDS } from "../src/engineering/approvalGate.js";
import { REQUIRED_FULL_GATES } from "../src/engineering/buildVerification.js";
import { RESTART_SENTINEL_EXIT_CODE } from "../src/gateway/restart.js";

/**
 * Consolidation checklist for Phase 5 deterministic north-star buckets (A–D).
 * Detailed behavior is covered in slice-specific suites; this file guards regressions
 * on the locked vocabulary and invariants.
 */
describe("phase 5 north star consolidation", () => {
  it("WorkItemStage includes staged, blocked, and parked", () => {
    const required: WorkItemStage[] = ["staged", "blocked", "parked"];
    for (const stage of required) {
      expect(["staged", "blocked", "parked", "done", "abandoned", "grill", "prd", "tests", "build", "ship"]).toContain(
        stage,
      );
    }
  });

  it("dangerous tools include promote, rollback, and restart", () => {
    for (const toolId of ["promote", "rollback", "restart", "stage-implementation"]) {
      expect(DANGEROUS_TOOL_IDS.has(toolId)).toBe(true);
    }
  });

  it("full verification gate order is locked", () => {
    expect(REQUIRED_FULL_GATES).toEqual([
      "ci",
      "permission-scan",
      "mock-contract",
      "code-review",
      "security-review",
      "remote-ci",
    ]);
  });

  it("controlled restart uses sentinel exit code 75", () => {
    expect(RESTART_SENTINEL_EXIT_CODE).toBe(75);
  });
});
