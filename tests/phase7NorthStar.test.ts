import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIRED_FULL_GATES } from "../src/engineering/buildVerification.js";
import {
  activationApprovalKey,
  alwaysAskTrustPolicy,
} from "../src/authoring/authoringApprovalSeam.js";
import { discoverAgentBundlesSync } from "../src/authoring/agentBundleRegistry.js";
import { discoverSkillsSync } from "../src/skills/skillRegistry.js";

describe("phase 7 north star consolidation", () => {
  it("includes mock-contract in full verification gates", () => {
    expect(REQUIRED_FULL_GATES).toContain("mock-contract");
  });

  it("discovers authoring-policy and proposal skills", () => {
    const skills = discoverSkillsSync(process.cwd());
    const names = skills.map((s) => s.name);
    expect(names).toContain("author-policy");
    expect(names).toContain("propose-extension");
    expect(names).toContain("write-tool");
    expect(names).toContain("write-workflow");
    expect(names).toContain("hire-agent");
    expect(names).toContain("onboard-agent");
  });

  it("agent bundles are source of truth with derived agentRegistry", () => {
    const bundles = discoverAgentBundlesSync(process.cwd());
    expect(bundles.some((b) => b.id === "engineering-lead")).toBe(true);
    expect(existsSync(join(process.cwd(), "agents/README.md"))).toBe(true);
  });

  it("approval seam is structured for future trust dial", () => {
    expect(alwaysAskTrustPolicy.canAutoApprove("skill", "x")).toBe(false);
    expect(activationApprovalKey("agent", "demo")).toBe("activate:agent:demo");
  });

  it("documents Phase 7 north star", () => {
    const doc = readFileSync(
      join(process.cwd(), "docs/phase-7-authoring-agents.md"),
      "utf-8",
    );
    expect(doc.toLowerCase()).toContain("safely");
    expect(doc).toContain("Skill Author");
  });
});
