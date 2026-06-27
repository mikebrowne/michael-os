import { describe, expect, it } from "vitest";
import {
  parseReviewVerdict,
  formatReviewVerdictReport,
  reviewVerdictSchema,
} from "../src/engineering/review.js";

describe("review", () => {
  it("parses JSON verdict from agent output", () => {
    const raw = `{"decision":"approve","rationale":"Looks good","findings":[]}`;
    const verdict = parseReviewVerdict(raw);
    expect(verdict.decision).toBe("approve");
    expect(reviewVerdictSchema.parse(verdict)).toBeTruthy();
  });

  it("parses fenced JSON verdict", () => {
    const raw = 'Here is the review:\n```json\n{"decision":"block","rationale":"Security issue","findings":[{"severity":"critical","file":"src/a.ts","message":"leak"}]}\n```';
    const verdict = parseReviewVerdict(raw);
    expect(verdict.decision).toBe("block");
    expect(verdict.findings).toHaveLength(1);
  });

  it("formats advisory report", () => {
    const report = formatReviewVerdictReport({
      decision: "request-changes",
      rationale: "Scope creep",
      findings: [
        { severity: "warning", file: "src/x.ts", message: "extra file" },
      ],
    });
    expect(report).toContain("REQUEST-CHANGES");
    expect(report).toContain("advisory");
  });
});
