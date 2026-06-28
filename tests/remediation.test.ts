import { describe, expect, it } from "vitest";
import {
  collectFailedFindings,
  createRemediationState,
  isRemediationCapReached,
  recordRemediationAttempt,
  triageGateFindings,
} from "../src/engineering/remediation.js";
import type { GateResult } from "../src/engineering/buildVerification.js";

describe("remediation", () => {
  it("loop-cap-halts at exactly the cap", () => {
    let state = createRemediationState(3);
    state = recordRemediationAttempt(state, [
      { severity: "warning", message: "fail 1", category: "code" },
    ]);
    state = { ...state, attemptCount: 1 };
    expect(isRemediationCapReached(state)).toBe(false);

    state = { ...state, attemptCount: 3 };
    expect(isRemediationCapReached(state)).toBe(true);
  });

  it("triage routes security findings to surface-security", () => {
    const gates: GateResult[] = [
      {
        kind: "security-review",
        status: "fail",
        findings: [{ severity: "critical", message: "vuln", category: "security" }],
      },
    ];
    expect(triageGateFindings(gates)).toBe("surface-security");
  });

  it("triage routes spec findings to escalate-spec", () => {
    const gates: GateResult[] = [
      {
        kind: "code-review",
        status: "fail",
        findings: [{ severity: "warning", message: "missing req", category: "spec" }],
      },
    ];
    expect(triageGateFindings(gates)).toBe("escalate-spec");
  });

  it("triage routes code-level failures to fix-loop", () => {
    const gates: GateResult[] = [
      {
        kind: "ci",
        status: "fail",
        findings: [{ severity: "critical", message: "lint fail", category: "ci" }],
      },
    ];
    expect(triageGateFindings(gates)).toBe("fix-loop");
  });

  it("collects failed findings from red gates only", () => {
    const findings = collectFailedFindings([
      { kind: "ci", status: "pass", findings: [] },
      {
        kind: "code-review",
        status: "fail",
        findings: [{ severity: "warning", message: "bug", category: "code" }],
      },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe("bug");
  });
});
