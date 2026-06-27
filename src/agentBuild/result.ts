import { writeFileSync } from "node:fs";
import type { PreflightResult } from "./types.js";
import type { RedGreenGateOutcome } from "./gates.js";
import type { CodingExecutorResult } from "./types.js";

export type ResultInput = {
  request: string;
  runDir: string;
  resultPath: string;
  diffPath: string;
  gitDiff: string;
  changedFiles: string[];
  cursorResult: CodingExecutorResult;
  gateOutcome: RedGreenGateOutcome;
  preflight: PreflightResult;
  specSummary: string;
  worktreePath: string;
};

export function writeGitDiff(diffPath: string, gitDiff: string): void {
  writeFileSync(diffPath, gitDiff || "(no changes)\n", "utf-8");
}

export function buildResultMarkdown(input: ResultInput): string {
  const {
    request,
    cursorResult,
    gateOutcome,
    preflight,
    changedFiles,
    specSummary,
    worktreePath,
  } = input;

  const overallSuccess =
    cursorResult.status === "finished" &&
    gateOutcome.greenGateValid &&
    preflight.passed;

  const preflightLines = preflight.steps
    .map((s) => {
      if (s.skipped) return `- ${s.script}: skipped`;
      return `- ${s.script}: ${s.passed ? "pass" : "fail"}`;
    })
    .join("\n");

  const gateLines = gateOutcome.messages.map((m) => `- ${m}`).join("\n");

  return `# Build Result

## Status

${overallSuccess ? "**SUCCESS**" : "**INCOMPLETE OR FAILED**"}

## Original Request

${request.trim()}

## What Was Built

${specSummary}

## Cursor Executor

- Started: ${cursorResult.started}
- Status: ${cursorResult.status}
- Run ID: ${cursorResult.runId ?? "n/a"}
- Summary: ${cursorResult.summary}
${cursorResult.startupError ? `- Startup error: ${cursorResult.startupError}` : ""}

## Files Changed

${changedFiles.length > 0 ? changedFiles.map((f) => `- ${f}`).join("\n") : "- (none)"}

## Gate Results

${gateLines}

## Preflight Results

${preflightLines}

Overall preflight: ${preflight.passed ? "PASS" : "FAIL"}

## Worktree

Isolated worktree at: \`${worktreePath}\`

Main branch working tree was not modified by the harness.

## Known Issues

${overallSuccess ? "- None identified." : "- See gate, cursor, and preflight sections above."}

## Recommended Next Step

${
  overallSuccess
    ? "- Review `git-diff.patch` and the worktree changes. Use the ship skill to commit via PR when ready."
    : "- Inspect logs in the run folder (`red-gate.log`, `green-gate.log`, `preflight.log`) and fix blockers before retrying."
}
`;
}

export function writeResult(input: ResultInput): { success: boolean; markdown: string } {
  writeGitDiff(input.diffPath, input.gitDiff);
  const markdown = buildResultMarkdown(input);
  writeFileSync(input.resultPath, markdown, "utf-8");
  const success =
    input.cursorResult.status === "finished" &&
    input.gateOutcome.greenGateValid &&
    input.preflight.passed;
  return { success, markdown };
}
