import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GateResult } from "../engineering/buildVerification.js";

export type SideEffectingToolContract = {
  toolId: string;
  sourcePath: string;
  declaresTestMode: boolean;
  declaresMock: boolean;
  hasSuppressionTest: boolean;
};

const TEST_MODE_PATTERNS = [
  /isSkillTestMode\s*\(/,
  /SKILL_TEST_MODE_KEY/,
  /testMode/,
];

const MOCK_PATTERNS = [
  /mocked:\s*true/,
  /FIXTURE_SIDE_EFFECT_MOCK/,
  /mocked:\s*false/,
  /sideEffectWritten:\s*false/,
];

const SUPPRESSION_TEST_PATTERNS = [
  /sideEffectWritten\)\.toBe\(false\)/,
  /mocked\)\.toBe\(true\)/,
  /mocked:\s*true/,
];

export function scanSideEffectingToolContract(
  toolId: string,
  sourcePath: string,
  repoRoot?: string,
): SideEffectingToolContract {
  let content = "";
  try {
    content = readFileSync(sourcePath, "utf-8");
  } catch {
    return {
      toolId,
      sourcePath,
      declaresTestMode: false,
      declaresMock: false,
      hasSuppressionTest: false,
    };
  }

  let declaresMock = MOCK_PATTERNS.some((p) => p.test(content));
  if (!declaresMock && content.includes("executeFixtureSideEffect")) {
    try {
      const helper = readFileSync(
        join(process.cwd(), "src/skills/skillEvalRunner.ts"),
        "utf-8",
      );
      declaresMock = MOCK_PATTERNS.some((p) => p.test(helper));
    } catch {
      // ignore
    }
  }

  let hasSuppressionTest = SUPPRESSION_TEST_PATTERNS.some((p) => p.test(content));
  if (!hasSuppressionTest && repoRoot) {
    const testsDir = join(repoRoot, "tests");
    if (existsSync(testsDir)) {
      for (const file of ["skillEval.test.ts", "mockContractGate.test.ts"]) {
        try {
          const testContent = readFileSync(join(testsDir, file), "utf-8");
          const referencesTool =
            testContent.includes(toolId) ||
            (toolId === "fixture-side-effect" &&
              testContent.includes("executeFixtureSideEffect"));
          if (
            referencesTool &&
            SUPPRESSION_TEST_PATTERNS.some((p) => p.test(testContent))
          ) {
            hasSuppressionTest = true;
            break;
          }
        } catch {
          continue;
        }
      }
    }
  }

  return {
    toolId,
    sourcePath,
    declaresTestMode: TEST_MODE_PATTERNS.some((p) => p.test(content)),
    declaresMock,
    hasSuppressionTest,
  };
}

export function mockContractPasses(contract: SideEffectingToolContract): boolean {
  return (
    contract.declaresTestMode &&
    contract.declaresMock &&
    contract.hasSuppressionTest
  );
}

export function runMockContractGate(
  contracts: SideEffectingToolContract[],
  override = false,
): GateResult {
  const failing = contracts.filter((c) => !mockContractPasses(c));
  if (failing.length === 0) {
    return { kind: "mock-contract", status: "pass", findings: [] };
  }
  if (override) {
    return {
      kind: "mock-contract",
      status: "pass",
      findings: failing.map((c) => ({
        severity: "warning" as const,
        file: c.sourcePath,
        message: `Mock contract override: ${c.toolId} missing testMode/mock/test (operator approved)`,
        category: "permission" as const,
      })),
      overridden: true,
    };
  }
  return {
    kind: "mock-contract",
    status: "fail",
    findings: failing.map((c) => ({
      severity: "critical" as const,
      file: c.sourcePath,
      message: buildMockContractFailureMessage(c),
      category: "permission" as const,
    })),
  };
}

export function buildMockContractFailureMessage(
  contract: SideEffectingToolContract,
): string {
  const missing: string[] = [];
  if (!contract.declaresTestMode) missing.push("testMode check");
  if (!contract.declaresMock) missing.push("declared mock");
  if (!contract.hasSuppressionTest) missing.push("suppression test");
  return `Side-effecting tool "${contract.toolId}" missing mock contract: ${missing.join(", ")}`;
}
