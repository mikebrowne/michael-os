import { describe, expect, it } from "vitest";
import {
  listAgents,
  getAgent,
  listMastraAgents,
} from "../src/mastra/agentRegistry.js";

describe("agentRegistry", () => {
  it("lists department agents with kinds", () => {
    const agents = listAgents();
    expect(agents.length).toBeGreaterThanOrEqual(3);
    expect(getAgent("engineering-lead")?.kind).toBe("mastra-agent");
    expect(getAgent("software-engineer")?.kind).toBe("external-executor");
    expect(getAgent("code-reviewer")?.kind).toBe("mastra-agent");
  });

  it("lists mastra agents only", () => {
    const mastra = listMastraAgents();
    expect(mastra.every((a) => a.kind === "mastra-agent")).toBe(true);
    expect(mastra.map((a) => a.id)).toContain("code-reviewer");
  });

  it("reserves directChat for phase 4", () => {
    const reviewer = getAgent("code-reviewer");
    expect(reviewer?.directChat).toBe(false);
    expect(reviewer?.standalone).toBe(true);
  });
});
