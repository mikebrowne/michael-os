import { describe, expect, it } from "vitest";
import { createApprovalState, grantPendingApproval } from "../src/engineering/approvalGate.js";
import {
  activationApprovalKey,
  alwaysAskTrustPolicy,
  requestActivationApproval,
  type TrustPolicy,
} from "../src/authoring/authoringApprovalSeam.js";

describe("authoring approval seam", () => {
  it("blocks activation without operator yes", () => {
    const approval = createApprovalState();
    const result = requestActivationApproval(approval, {
      category: "skill",
      artifactId: "demo-skill",
    });
    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.needsApproval).toBe(true);
      expect(approval.pending?.toolId).toBe(
        activationApprovalKey("skill", "demo-skill"),
      );
    }
  });

  it("approves after operator yes via grantPendingApproval", () => {
    const approval = createApprovalState();
    requestActivationApproval(approval, {
      category: "tool",
      artifactId: "demo-tool",
    });
    grantPendingApproval(approval);
    const second = requestActivationApproval(approval, {
      category: "tool",
      artifactId: "demo-tool",
    });
    expect(second.approved).toBe(true);
    if (second.approved) {
      expect(second.autoApproved).toBe(false);
    }
  });

  it("exposes a single trust policy injection point", () => {
    const autoPolicy: TrustPolicy = {
      canAutoApprove: (category, artifactId) =>
        category === "skill" && artifactId === "low-risk",
    };
    const approval = createApprovalState();
    const result = requestActivationApproval(
      approval,
      { category: "skill", artifactId: "low-risk" },
      autoPolicy,
    );
    expect(result.approved).toBe(true);
    if (result.approved) {
      expect(result.autoApproved).toBe(true);
    }

    const blocked = requestActivationApproval(
      approval,
      { category: "tool", artifactId: "risky" },
      autoPolicy,
    );
    expect(blocked.approved).toBe(false);
  });

  it("alwaysAskTrustPolicy never auto-approves", () => {
    expect(alwaysAskTrustPolicy.canAutoApprove("skill", "x")).toBe(false);
  });
});
