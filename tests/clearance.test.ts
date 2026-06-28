import { describe, expect, it } from "vitest";
import {
  canAgentUseTool,
  isManagementTool,
} from "../src/engineering/agentAuthority.js";
import { getAgent } from "../src/mastra/agentRegistry.js";

describe("clearance", () => {
  it("QA Engineer (employee) cannot promote/rollback/restart", () => {
    const qa = getAgent("qa-engineer");
    expect(qa?.authority).toBe("employee");

    for (const toolId of ["promote", "rollback", "restart", "stage-implementation"]) {
      expect(isManagementTool(toolId)).toBe(true);
      expect(canAgentUseTool("employee", toolId)).toBe(false);
      expect(canAgentUseTool("management", toolId)).toBe(true);
    }
  });

  it("Engineering Lead (management) can use promotion tools", () => {
    const el = getAgent("engineering-lead");
    expect(el?.authority).toBe("management");
    expect(canAgentUseTool("management", "promote")).toBe(true);
  });
});
