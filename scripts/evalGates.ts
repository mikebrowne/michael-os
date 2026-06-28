#!/usr/bin/env tsx
/**
 * Local-only Phase 5 gate judgment evals (bucket E).
 * Requires OPENAI_API_KEY — not run in CI.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createQaEngineerAgent } from "../src/mastra/agents/qa-engineer.js";
import { scanPermissionDiff } from "../src/engineering/permissionScan.js";
import { runSecurityReview, runCodeReview } from "../src/engineering/review.js";
import {
  triageGateFindings,
  createRemediationState,
  isRemediationCapReached,
  recordRemediationAttempt,
} from "../src/engineering/remediation.js";
import type { GateResult } from "../src/engineering/buildVerification.js";

const SEEDED_VULN_DIFF = `
diff --git a/src/engineering/approvalGate.ts b/src/engineering/approvalGate.ts
+  "restart",
+  "shell-exec",
`;

const SEEDED_DEFECT_DIFF = `
diff --git a/src/foo.ts b/src/foo.ts
+export function divide(a: number, b: number) {
+  return a / b; // no zero check
+}
`;

const CLEAN_DIFF = `
diff --git a/docs/readme.md b/docs/readme.md
+# docs only
`;

function logStep(message: string): void {
  console.error(`eval:gates — ${message}`);
}

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);

  const dir = mkdtempSync(join(tmpdir(), "michael-os-eval-gates-"));
  const results: Record<string, boolean> = {};

  try {
    const agent = createQaEngineerAgent(config.defaultReviewModel, process.cwd());
    const prd = "# PRD\nFeature scope.\n";
    const acceptance = "test('acceptance', () => {})";

    results["seeded-vulnerability-caught"] =
      scanPermissionDiff(SEEDED_VULN_DIFF).length > 0;
    logStep(
      `permission scan on seeded vuln: ${results["seeded-vulnerability-caught"] ? "caught" : "missed"}`,
    );

    logStep("security review on seeded vuln (model)…");
    const securityVerdict = await runSecurityReview(agent, {
      gitDiff: SEEDED_VULN_DIFF,
      prdMarkdown: prd,
      acceptanceTest: acceptance,
      changedFiles: ["src/engineering/approvalGate.ts"],
    });
    results["seeded-vulnerability-caught"] =
      results["seeded-vulnerability-caught"] ||
      securityVerdict.decision !== "approve";

    logStep("code review on seeded defect (model)…");
    const defectVerdict = await runCodeReview(agent, {
      gitDiff: SEEDED_DEFECT_DIFF,
      prdMarkdown: prd,
      acceptanceTest: acceptance,
      changedFiles: ["src/foo.ts"],
    });
    results["seeded-defect-caught"] = defectVerdict.decision !== "approve";

    logStep("security + code review on clean diff (model)…");
    const cleanSecurity = await runSecurityReview(agent, {
      gitDiff: CLEAN_DIFF,
      prdMarkdown: prd,
      acceptanceTest: acceptance,
      changedFiles: ["docs/readme.md"],
    });
    const cleanReview = await runCodeReview(agent, {
      gitDiff: CLEAN_DIFF,
      prdMarkdown: prd,
      acceptanceTest: acceptance,
      changedFiles: ["docs/readme.md"],
    });
    results["no-false-block-on-clean"] =
      cleanSecurity.decision === "approve" && cleanReview.decision === "approve";

    const specGates: GateResult[] = [
      {
        kind: "code-review",
        status: "fail",
        findings: [
          { severity: "warning", message: "missing requirement", category: "spec" },
        ],
      },
    ];
    const codeGates: GateResult[] = [
      {
        kind: "ci",
        status: "fail",
        findings: [{ severity: "critical", message: "lint", category: "code" }],
      },
    ];
    results["triage-routes-correctly"] =
      triageGateFindings(specGates) === "escalate-spec" &&
      triageGateFindings(codeGates) === "fix-loop";

    let remediation = createRemediationState(3);
    remediation = recordRemediationAttempt(remediation, [
      { severity: "warning", message: "bug", category: "code" },
    ]);
    remediation = { ...remediation, attemptCount: 3 };
    results["remediation-converges-and-halts"] = isRemediationCapReached(remediation);
    logStep("deterministic triage + remediation cap checks done");

    writeFileSync(join(dir, "eval-gates-results.json"), JSON.stringify(results, null, 2));

    const passed = Object.values(results).every(Boolean);
    console.log(JSON.stringify({ passed, results }, null, 2));
    process.exit(passed ? 0 : 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
