import { describe, expect, it, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config/loadConfig.js";
import { createMastraHarness } from "../src/mastra/mastraHarness.js";
import { resetMastraStorageForTests } from "../src/mastra/mastraStorage.js";
import { resetAgentMemoryForTests } from "../src/mastra/agentMemory.js";
import { createEngineeringLeadAgent } from "../src/mastra/agents/engineering-lead.js";
import { createQaEngineerAgent } from "../src/mastra/agents/qa-engineer.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import {
  discoverSkills,
  resolveAgentSkillBundlePaths,
  loadSkillInstructions,
  SKILL_BUNDLE_NAMES,
} from "../src/skills/skillRegistry.js";
import { getAgent } from "../src/mastra/agentRegistry.js";

const REPO_ROOT = process.cwd();

function agentInstructions(agent: {
  __getOverridableFields: () => { instructions: unknown };
}): string {
  const { instructions } = agent.__getOverridableFields();
  if (typeof instructions === "string") {
    return instructions;
  }
  throw new Error("Expected static string instructions in test agent");
}

describe("skillRegistry", () => {
  afterEach(() => {
    resetMastraStorageForTests();
    resetAgentMemoryForTests();
  });

  it("discovers all 7 skill bundles with name and description", async () => {
    const skills = await discoverSkills(REPO_ROOT);
    expect(skills).toHaveLength(SKILL_BUNDLE_NAMES.length);
    for (const expected of SKILL_BUNDLE_NAMES) {
      const found = skills.find((s) => s.name === expected);
      expect(found, `missing skill ${expected}`).toBeDefined();
      expect(found!.description.length).toBeGreaterThan(0);
      expect(found!.status).toBe("active");
    }
  });

  it("resolveAgentSkillBundlePaths returns existing bundle directories", () => {
    const elSkills = getAgent("engineering-lead")?.skills ?? [];
    const paths = resolveAgentSkillBundlePaths(REPO_ROOT, elSkills);
    expect(paths).toHaveLength(elSkills.length);
    for (const p of paths) {
      expect(existsSync(join(p, "SKILL.md"))).toBe(true);
    }
  });

  it("loadSkillInstructions returns markdown body without frontmatter", () => {
    const body = loadSkillInstructions(REPO_ROOT, "grill-me-with-docs");
    expect(body).toContain("Grill me with docs");
    expect(body).toContain("one question at a time");
    expect(body).not.toContain("name: grill-me-with-docs");
  });
});

describe("skill migration regression", () => {
  afterEach(() => {
    resetMastraStorageForTests();
    resetAgentMemoryForTests();
  });

  it("Engineering Lead uses progressive loading — no eager skill bodies in instructions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-migration-"));
    try {
      const base = loadConfig();
      const config = {
        ...base,
        logDir: join(dir, "logs"),
        mastraDir: join(dir, ".mastra"),
        stateDir: join(dir, "state"),
      };
      const ctx = createEngineeringSessionContext(config, {
        repoPath: REPO_ROOT,
      });
      const qa = createQaEngineerAgent(config.defaultReviewModel, REPO_ROOT);
      const el = createEngineeringLeadAgent(
        config.defaultModel,
        ctx,
        REPO_ROOT,
        qa,
      );

      const instructions = agentInstructions(el);
      expect(instructions).not.toContain("## Skill:");
      expect(instructions).not.toContain("Interview relentlessly");
      expect(instructions).not.toContain("save-grill-notes` with a markdown summary");
      expect(instructions).toContain("progressive loading");
      expect(instructions).toContain("skill** tool");

      const tools = await el.getToolsForExecution({});
      expect(Object.keys(tools)).toContain("skill");
      expect(Object.keys(tools)).toContain("skill_search");
      expect(Object.keys(tools)).toContain("skill_read");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("QA Engineer embeds code-review and security-review bodies for one-shot verdicts", () => {
    const qa = createQaEngineerAgent("openai/gpt-4o-mini", REPO_ROOT);
    const instructions = agentInstructions(qa);
    expect(instructions).toContain("Correctness vs PRD");
    expect(instructions).toContain("Injection / XSS / SSRF");
    expect(instructions).toContain("Skills reference");
  });

  it("harness boots with skill-enabled Engineering Lead", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-harness-"));
    try {
      const base = loadConfig();
      const config = {
        ...base,
        logDir: join(dir, "logs"),
        mastraDir: join(dir, ".mastra"),
        stateDir: join(dir, "state"),
      };
      const harness = createMastraHarness(config, REPO_ROOT);
      expect(harness.engineeringLeadAgent.id).toBe("engineering-lead");
      const instructions = agentInstructions(harness.engineeringLeadAgent);
      expect(instructions).not.toContain("## Skill:");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
