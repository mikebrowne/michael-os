import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  aggregateGateResults,
  assertAllGatesPresent,
  canPromoteWithVerdict,
  REQUIRED_SLICE2_GATES,
} from "../src/engineering/buildVerification.js";
import {
  runBuildVerification,
  runCodeReviewGate,
} from "../src/engineering/buildVerificationRunner.js";
import type { Agent } from "@mastra/core/agent";

describe("buildVerification", () => {
  it("aggregates pass only when all gates pass", () => {
    const verdict = aggregateGateResults([
      { kind: "ci", status: "pass", findings: [] },
      { kind: "code-review", status: "pass", findings: [] },
    ]);
    expect(verdict.overall).toBe("pass");
  });

  it("fails overall when any gate fails without override", () => {
    const verdict = aggregateGateResults([
      { kind: "ci", status: "pass", findings: [] },
      {
        kind: "code-review",
        status: "fail",
        findings: [{ severity: "warning", message: "nit" }],
      },
    ]);
    expect(verdict.overall).toBe("fail");
  });

  it("allows promotion with per-gate override", () => {
    const verdict = aggregateGateResults([
      { kind: "ci", status: "fail", findings: [{ severity: "critical", message: "lint" }] },
      { kind: "code-review", status: "pass", findings: [] },
    ]);
    expect(canPromoteWithVerdict(verdict, { ci: true })).toBe(true);
  });

  it("gate-cannot-be-skipped invariant", () => {
    const verdict = aggregateGateResults([
      { kind: "ci", status: "pass", findings: [] },
    ]);
    expect(() => assertAllGatesPresent(verdict, REQUIRED_SLICE2_GATES)).toThrow(
      /Gate cannot be skipped/,
    );
  });

  it("runs gates in deterministic order with controlled review verdict", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-bv-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: {} }), "utf-8");

    try {
      const agent = {
        generate: async () => {
          throw new Error("should not call agent when reviewVerdict supplied");
        },
      } as unknown as Agent;

      const codeReviewGate = await runCodeReviewGate({
        worktreePath: dir,
        codeReviewInput: {
          gitDiff: "",
          prdMarkdown: "# PRD",
          acceptanceTest: "test('x',()=>{})",
          changedFiles: [],
        },
        agent,
        reviewVerdict: {
          decision: "approve",
          rationale: "controlled",
          findings: [],
        },
      });

      const verdict = await runBuildVerification({
        worktreePath: dir,
        codeReviewInput: {
          gitDiff: "",
          prdMarkdown: "# PRD",
          acceptanceTest: "test('x',()=>{})",
          changedFiles: [],
        },
        agent,
        reviewVerdict: {
          decision: "approve",
          rationale: "controlled",
          findings: [],
        },
      });

      expect(codeReviewGate.kind).toBe("code-review");
      assertAllGatesPresent(verdict, REQUIRED_SLICE2_GATES);
      expect(verdict.gates[0]?.kind).toBe("ci");
      expect(verdict.gates[1]?.kind).toBe("code-review");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
