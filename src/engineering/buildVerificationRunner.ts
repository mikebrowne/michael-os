import { runPreflight } from "../agentBuild/preflight.js";
import {
  aggregateGateResults,
  type BuildVerificationVerdict,
  type GateResult,
} from "./buildVerification.js";
import {
  runCodeReview,
  type CodeReviewInput,
  type ReviewVerdict,
} from "./review.js";
import type { Agent } from "@mastra/core/agent";

export type RunBuildVerificationOptions = {
  worktreePath: string;
  codeReviewInput: CodeReviewInput;
  agent?: Agent;
  reviewVerdict?: ReviewVerdict;
};

export function runCiGate(worktreePath: string): GateResult {
  const preflight = runPreflight(worktreePath);
  const findings = preflight.steps
    .filter((s) => s.ran && !s.passed)
    .map((s) => ({
      severity: "critical" as const,
      message: `CI gate failed: npm run ${s.script}`,
      category: "ci" as const,
    }));
  return {
    kind: "ci",
    status: preflight.passed ? "pass" : "fail",
    findings,
  };
}

export async function runCodeReviewGate(
  options: RunBuildVerificationOptions,
): Promise<GateResult> {
  let reviewVerdict = options.reviewVerdict;
  if (!reviewVerdict) {
    if (!options.agent) {
      throw new Error("Code review gate requires agent or reviewVerdict");
    }
    reviewVerdict = await runCodeReview(options.agent, options.codeReviewInput);
  }

  const findings = reviewVerdict.findings.map((f) => ({
    severity: f.severity,
    file: f.file,
    line: f.line,
    message: f.message,
    category: "code" as const,
  }));

  return {
    kind: "code-review",
    status: reviewVerdict.decision === "approve" ? "pass" : "fail",
    findings,
  };
}

/** Deterministic gate ordering: CI → code review → aggregate (ADR 0008). */
export async function runBuildVerification(
  options: RunBuildVerificationOptions,
): Promise<BuildVerificationVerdict> {
  const ciGate = runCiGate(options.worktreePath);
  const codeReviewGate = await runCodeReviewGate(options);
  return aggregateGateResults([ciGate, codeReviewGate]);
}
