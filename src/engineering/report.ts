import type { RunAgentBuildResult } from "../agentBuild/runAgentBuild.js";
import { isBuildGreen } from "../agentBuild/runAgentBuild.js";
import type { ReviewVerdict } from "./review.js";
import { formatReviewVerdictReport } from "./review.js";

export type ChatReport = {
  headline: string;
  body: string;
  canPromptPush: boolean;
  success: boolean;
};

export function formatBuildChatReport(
  result: RunAgentBuildResult,
  reviewVerdict?: ReviewVerdict | null,
): ChatReport {
  const success = isBuildGreen(result);
  const status = success ? "SUCCESS" : "FAILED";
  const headline = `Build ${status}: ${result.request.slice(0, 80)}`;

  const lines: string[] = [
    `Status: ${status}`,
    `Run folder: ${result.runDir}`,
    `Files changed: ${result.changedFiles.length > 0 ? result.changedFiles.join(", ") : "(none)"}`,
    ...result.gateOutcome.messages.map((m) => `Gate: ${m}`),
    ...result.preflight.steps.map((s) => {
      if (s.skipped) return `Preflight ${s.script}: skipped`;
      return `Preflight ${s.script}: ${s.passed ? "pass" : "fail"}`;
    }),
  ];

  if (success) {
    const diffPreview = result.gitDiff.split("\n").slice(0, 40).join("\n");
    lines.push("", "Diff preview (first 40 lines):", diffPreview || "(empty)");
    if (reviewVerdict) {
      lines.push("", "--- Code review (advisory) ---", formatReviewVerdictReport(reviewVerdict));
    } else {
      lines.push("", "Next: call review-build for advisory code review before ship.");
    }
    lines.push("", 'Say "yes" to push implementation to main, or "show diff" for the full patch.');
  } else {
    lines.push("", "Failure details:");
    if (result.cursorResult.startupError) {
      lines.push(`Cursor startup: ${result.cursorResult.startupError}`);
    }
    lines.push(`Cursor summary: ${result.cursorResult.summary}`);
    const failedStep = result.preflight.steps.find((s) => s.ran && !s.passed);
    if (failedStep) {
      lines.push("", `Preflight failure (${failedStep.script}):`, failedStep.output.slice(0, 1500));
    }
    lines.push("", "Push is not available until the build is green.");
  }

  return {
    headline,
    body: lines.join("\n"),
    canPromptPush: success,
    success,
  };
}
