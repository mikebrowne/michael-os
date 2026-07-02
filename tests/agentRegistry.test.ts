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
    expect(getAgent("qa-engineer")?.kind).toBe("mastra-agent");
  });

  it("lists mastra agents only", () => {
    const mastra = listMastraAgents();
    expect(mastra.every((a) => a.kind === "mastra-agent")).toBe(true);
    expect(mastra.map((a) => a.id)).toContain("qa-engineer");
  });

  it("engagement manager has directChat in phase 4b", () => {
    const em = getAgent("engagement-manager");
    expect(em?.directChat).toBe(true);
    expect(em?.standalone).toBe(true);
    expect(em?.authority).toBe("employee");
  });

  it("reserves directChat for phase 4b", () => {
    const qaEngineer = getAgent("qa-engineer");
    expect(qaEngineer?.directChat).toBe(false);
    expect(qaEngineer?.standalone).toBe(true);
    expect(qaEngineer?.authority).toBe("employee");
    expect(getAgent("engineering-lead")?.authority).toBe("management");
  });
});
