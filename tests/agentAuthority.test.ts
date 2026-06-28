import { describe, expect, it } from "vitest";
import {
  canAgentUseTool,
  filterToolsByAuthority,
  isManagementTool,
} from "../src/engineering/agentAuthority.js";
import { getAgent } from "../src/mastra/agentRegistry.js";

describe("agentAuthority", () => {
  it("identifies management tools", () => {
    expect(isManagementTool("run-build")).toBe(true);
    expect(isManagementTool("review-build")).toBe(false);
  });

  it("blocks employees from dangerous tools", () => {
    expect(canAgentUseTool("employee", "run-build")).toBe(false);
    expect(canAgentUseTool("management", "run-build")).toBe(true);
    expect(canAgentUseTool("employee", "review-build")).toBe(true);
  });

  it("registry assigns authority correctly", () => {
    expect(getAgent("engineering-lead")?.authority).toBe("management");
    expect(getAgent("qa-engineer")?.authority).toBe("employee");
  });

  it("filters tool map for employees", () => {
    const filtered = filterToolsByAuthority(
      {
        "run-build": { id: "run-build" },
        "review-build": { id: "review-build" },
      },
      "employee",
    );
    expect(Object.keys(filtered)).toEqual(["review-build"]);
  });
});
