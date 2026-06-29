import { describe, expect, it } from "vitest";
import {
  createApprovalState,
  grantSessionApproval,
  consumeSessionApproval,
  clearSessionApprovalsForBuild,
} from "../src/engineering/approvalGate.js";

describe("session-scoped approval", () => {
  it("grants and consumes dispatch-slice for one build slug", () => {
    const state = createApprovalState();
    grantSessionApproval(state, "dispatch-slice", "feat-a");
    expect(consumeSessionApproval(state, "dispatch-slice", "feat-a")).toBe(true);
    expect(consumeSessionApproval(state, "dispatch-slice", "feat-b")).toBe(false);
  });

  it("clears grants when build ends", () => {
    const state = createApprovalState();
    grantSessionApproval(state, "dispatch-slice", "feat-a");
    clearSessionApprovalsForBuild(state, "feat-a");
    expect(consumeSessionApproval(state, "dispatch-slice", "feat-a")).toBe(false);
  });
});
