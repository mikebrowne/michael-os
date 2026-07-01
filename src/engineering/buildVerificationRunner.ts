import { runPreflight } from "../agentBuild/preflight.js";
import {
  aggregateGateResults,
  type BuildVerificationVerdict,
  type GateResult,
} from "./buildVerification.js";
import {
  runCodeReview,
  runSecurityReview,
  type CodeReviewInput,
  type ReviewVerdict,
} from "./review.js";
import { scanPermissionDiff } from "./permissionScan.js";
import { getPrChecks, type GhRunner } from "./github.js";
import type { Agent } from "@mastra/core/agent";
import {
  runMockContractGate,
  scanSideEffectingToolContract,
  type SideEffectingToolContract,
} from "../authoring/mockContractGate.js";

export type RunBuildVerificationOptions = {
  worktreePath: string;
  codeReviewInput: CodeReviewInput;
  agent?: Agent;
  reviewVerdict?: ReviewVerdict;
  securityVerdict?: ReviewVerdict;
  prNumber?: number;
  githubRepo?: string;
  ghRunner?: GhRunner;
  remoteCiOverride?: boolean;
  mockContractOverride?: boolean;
  sideEffectingToolContracts?: SideEffectingToolContract[];
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

export function runPermissionScanGate(gitDiff: string): GateResult {
  const scanFindings = scanPermissionDiff(gitDiff);
  return {
    kind: "permission-scan",
    status: scanFindings.length === 0 ? "pass" : "fail",
    findings: scanFindings.map((f) => ({
      severity: "warning" as const,
      file: f.file,
      message: `[${f.rule}] ${f.message}`,
      category: "permission" as const,
    })),
  };
}

function reviewVerdictToGate(
  kind: "code-review" | "security-review",
  verdict: ReviewVerdict,
  category: "code" | "security",
): GateResult {
  const findings = verdict.findings.map((f) => ({
    severity: f.severity,
    file: f.file,
    line: f.line,
    message: f.message,
    category,
  }));
  return {
    kind,
    status: verdict.decision === "approve" ? "pass" : "fail",
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
  return reviewVerdictToGate("code-review", reviewVerdict, "code");
}

export async function runSecurityReviewGate(
  options: RunBuildVerificationOptions,
): Promise<GateResult> {
  let securityVerdict = options.securityVerdict;
  if (!securityVerdict) {
    if (!options.agent) {
      throw new Error("Security review gate requires agent or securityVerdict");
    }
    securityVerdict = await runSecurityReview(
      options.agent,
      options.codeReviewInput,
    );
  }
  return reviewVerdictToGate("security-review", securityVerdict, "security");
}

export async function runRemoteCiGate(
  options: RunBuildVerificationOptions,
): Promise<GateResult> {
  if (options.remoteCiOverride) {
    return {
      kind: "remote-ci",
      status: "pass",
      findings: [],
      overridden: true,
    };
  }

  if (
    options.prNumber == null ||
    !options.githubRepo ||
    !options.ghRunner
  ) {
    return {
      kind: "remote-ci",
      status: "pass",
      findings: [
        {
          severity: "info",
          message: "Remote CI skipped (no PR/gh context in test)",
          category: "ci",
        },
      ],
    };
  }

  const checks = await getPrChecks(
    options.ghRunner,
    options.githubRepo,
    options.prNumber,
  );
  const failed = checks.filter(
    (c) => c.state === "FAILURE" || c.conclusion === "FAILURE",
  );
  return {
    kind: "remote-ci",
    status: failed.length === 0 ? "pass" : "fail",
    findings: failed.map((c) => ({
      severity: "critical" as const,
      message: `Remote CI check failed: ${c.name}`,
      category: "ci" as const,
    })),
  };
}

/** Deterministic gate ordering: CI → permission → mock-contract → code → security → remote CI. */
export async function runBuildVerification(
  options: RunBuildVerificationOptions,
): Promise<BuildVerificationVerdict> {
  const ciGate = runCiGate(options.worktreePath);
  const permissionGate = runPermissionScanGate(options.codeReviewInput.gitDiff);
  const mockContractGate = runMockContractGate(
    options.sideEffectingToolContracts ?? [],
    options.mockContractOverride ?? false,
  );
  const codeReviewGate = await runCodeReviewGate(options);
  const securityGate = await runSecurityReviewGate(options);
  const remoteCiGate = await runRemoteCiGate(options);
  return aggregateGateResults([
    ciGate,
    permissionGate,
    mockContractGate,
    codeReviewGate,
    securityGate,
    remoteCiGate,
  ]);
}

export { scanSideEffectingToolContract };
