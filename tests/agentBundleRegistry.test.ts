import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  discoverActiveAgentBundlesSync,
  discoverAgentBundlesSync,
  employeeBundleCannotHoldManagementTools,
  validateAgentBundle,
  loadAgentBundleSync,
} from "../src/authoring/agentBundleRegistry.js";
import { resetAgentRegistryCache } from "../src/mastra/agentRegistry.js";
import { listAgents, getAgent } from "../src/mastra/agentRegistry.js";

describe("agent bundle registry", () => {
  it("discovers committed agent bundles as derived registry view", () => {
    resetAgentRegistryCache();
    const bundles = discoverAgentBundlesSync(process.cwd());
    expect(bundles.length).toBeGreaterThanOrEqual(5);
    const agents = listAgents(process.cwd());
    expect(agents.map((a) => a.id)).toContain("engineering-lead");
    expect(getAgent("skill-engineer", process.cwd())?.authority).toBe("employee");
  });

  it("employee bundle cannot hold management-only tools", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-agent-bundle-"));
    const bundleDir = join(dir, "agents", "bad-employee");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(
      join(bundleDir, "agent.md"),
      [
        "---",
        "id: bad-employee",
        "role: Bad",
        "kind: mastra-agent",
        "authority: employee",
        "description: Should fail authority check",
        "directChat: false",
        "standalone: true",
        "status: draft",
        "tools:",
        "  - promote",
        "---",
      ].join("\n"),
      "utf-8",
    );

    const bundle = loadAgentBundleSync(dir, "bad-employee");
    expect(employeeBundleCannotHoldManagementTools(bundle)).toBe(false);
    const validation = validateAgentBundle(bundle);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("management-only"))).toBe(
      true,
    );
  });

  it("adding an agent needs no ts edits — bundle discovery only", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-new-agent-"));
    const bundleDir = join(dir, "agents", "demo-helper");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(
      join(bundleDir, "agent.md"),
      [
        "---",
        "id: demo-helper",
        "role: Demo Helper",
        "kind: mastra-agent",
        "authority: employee",
        "description: Test hire bundle",
        "directChat: false",
        "standalone: true",
        "status: active",
        "skills:",
        "  - author-policy",
        "---",
      ].join("\n"),
      "utf-8",
    );

    const active = discoverActiveAgentBundlesSync(dir);
    expect(active.some((a) => a.id === "demo-helper")).toBe(true);
  });
});
