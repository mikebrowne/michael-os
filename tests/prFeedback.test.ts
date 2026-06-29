import { describe, expect, it } from "vitest";
import { normalizePrFeedbackToCorrectiveSlice } from "../src/engineering/prFeedback.js";

describe("prFeedback", () => {
  it("normalizes comments and CI failures into corrective slice prompt", () => {
    const prompt = normalizePrFeedbackToCorrectiveSlice(42, [
      { kind: "comment", author: "reviewer", body: "Please add a test." },
      { kind: "ci_failure", body: "CI check failed: lint" },
    ]);
    expect(prompt).toContain("PR #42");
    expect(prompt).toContain("Please add a test");
    expect(prompt).toContain("CI check failed");
  });
});
