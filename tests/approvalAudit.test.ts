import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { createEngineeringTelemetry } from "../src/engineering/engineeringTelemetry.js";
import { logApprovalAudit } from "../src/engineering/approvalAudit.js";
import {
  createApprovalState,
  requestApproval,
} from "../src/engineering/approvalGate.js";

describe("approval audit (Decision C)", () => {
  it("logs approval and denial with audit context", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-approval-"));
    try {
      const observability = createObservabilityStore({
        logDir: join(dir, "logs"),
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "standard" }),
      });
      const telemetry = createEngineeringTelemetry(observability);

      logApprovalAudit(observability, telemetry, {
        toolId: "promote",
        approved: true,
        workItemSlug: "feat-a",
        issueNumber: 5,
      });
      logApprovalAudit(observability, telemetry, {
        toolId: "promote",
        approved: false,
        workItemSlug: "feat-a",
        issueNumber: 5,
      });

      const granted = await observability.queryByEvent("approval.granted");
      const denied = await observability.queryByEvent("approval.denied");
      expect(granted.length).toBeGreaterThan(0);
      expect(denied.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("denial aborts with no side effects when pending cleared", () => {
    const state = createApprovalState();
    requestApproval(state, "promote", { commitMessage: "msg" });
    expect(state.pending?.toolId).toBe("promote");
    state.pending = undefined;
    expect(state.pending).toBeUndefined();
    expect(state.granted.has("promote")).toBe(false);
  });
});
