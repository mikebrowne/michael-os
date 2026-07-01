import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mockContractPasses,
  runMockContractGate,
  scanSideEffectingToolContract,
} from "../src/authoring/mockContractGate.js";

const FIXTURE = join(
  process.cwd(),
  "src/mastra/tools/skillEngineer/fixtureSideEffectTool.ts",
);

describe("mock-contract gate", () => {
  it("passes fixture side-effect tool with declared mock + testMode", () => {
    const contract = scanSideEffectingToolContract(
      "fixture-side-effect",
      FIXTURE,
      process.cwd(),
    );
    expect(mockContractPasses(contract)).toBe(true);
    const gate = runMockContractGate([contract]);
    expect(gate.status).toBe("pass");
  });

  it("blocks side-effecting tool lacking mock contract", () => {
    const contract = scanSideEffectingToolContract(
      "bad-tool",
      join(process.cwd(), "src/mastra/tools/demo-tool.ts"),
    );
    expect(mockContractPasses(contract)).toBe(false);
    const gate = runMockContractGate([contract]);
    expect(gate.status).toBe("fail");
  });

  it("allows operator override with logged overridden flag", () => {
    const contract = scanSideEffectingToolContract(
      "bad-tool",
      join(process.cwd(), "src/mastra/tools/demo-tool.ts"),
    );
    const gate = runMockContractGate([contract], true);
    expect(gate.status).toBe("pass");
    expect(gate.overridden).toBe(true);
  });

  it("fixture suppression test exists in skillEval tests", () => {
    const testSrc = readFileSync(
      join(process.cwd(), "tests/skillEval.test.ts"),
      "utf-8",
    );
    expect(testSrc).toMatch(/mocked\)\.toBe\(true\)/);
    expect(testSrc).toMatch(/sideEffectWritten\)\.toBe\(false\)/);
  });
});
