import { describe, expect, it } from "vitest";
import {
  createApprovalState,
  requestApproval,
  grantApproval,
  consumeApproval,
} from "../src/engineering/approvalGate.js";

describe("approvalRetry", () => {
  it("stores pending tool args for replay", () => {
    const state = createApprovalState();
    const args = { slug: "my-feature", requestSummary: "Build it" };
    requestApproval(state, "run-build", args);
    expect(state.pending?.toolId).toBe("run-build");
    expect(state.pending?.args).toEqual(args);
  });

  it("grants and consumes approval for deterministic replay", () => {
    const state = createApprovalState();
    requestApproval(state, "ship-docs", { slug: "x", commitMessage: "docs" });
    grantApproval(state, "ship-docs");
    expect(state.pending).toBeUndefined();
    expect(consumeApproval(state, "ship-docs")).toBe(true);
    expect(consumeApproval(state, "ship-docs")).toBe(false);
  });
});
