import type { GateFinding, GateResult } from "./buildVerification.js";

export type RemediationTriage = "fix-loop" | "escalate-spec" | "surface-security";

export function triageGateFindings(gates: GateResult[]): RemediationTriage {
  for (const gate of gates) {
    if (gate.status === "pass" || gate.overridden) continue;

    if (gate.kind === "permission-scan" || gate.kind === "security-review") {
      return "surface-security";
    }

    for (const finding of gate.findings) {
      if (finding.category === "security" || finding.category === "permission") {
        return "surface-security";
      }
      if (finding.category === "spec") {
        return "escalate-spec";
      }
    }
  }
  return "fix-loop";
}

export function findingsToRemediationContext(findings: GateFinding[]): string {
  if (findings.length === 0) return "No structured findings.";
  return findings
    .map((f) => `- [${f.severity}] ${f.file ? `${f.file}: ` : ""}${f.message}`)
    .join("\n");
}

export type RemediationState = {
  attemptCount: number;
  cap: number;
  lastFindings: GateFinding[];
};

export function createRemediationState(cap: number): RemediationState {
  return { attemptCount: 0, cap, lastFindings: [] };
}

export function recordRemediationAttempt(
  state: RemediationState,
  findings: GateFinding[],
): RemediationState {
  return {
    ...state,
    attemptCount: state.attemptCount + 1,
    lastFindings: findings,
  };
}

export function isRemediationCapReached(state: RemediationState): boolean {
  return state.attemptCount >= state.cap;
}

export function shouldBlockAfterCap(state: RemediationState): boolean {
  return state.attemptCount >= state.cap;
}

export function collectFailedFindings(gates: GateResult[]): GateFinding[] {
  return gates
    .filter((g) => g.status === "fail" && !g.overridden)
    .flatMap((g) => g.findings);
}
