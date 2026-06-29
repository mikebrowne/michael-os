import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertAgentRegistryMatchesSkills,
  canInjectSkill,
  discoverSkillsSync,
  loadSkillRegistrationSync,
  qaNeverGetsAuthoringSkills,
  resolveSkillNamesForAgent,
  resolveSkillsForAgent,
  validateSkill,
  validateSkillRegistration,
} from "../src/skills/skillRegistry.js";
import {
  validateSkillMetadata,
  SKILL_LIMITS,
} from "../src/skills/skillValidation.js";

const REPO_ROOT = process.cwd();

describe("skillPermissions", () => {
  it("all 7 production skills pass validation", () => {
    for (const skill of discoverSkillsSync(REPO_ROOT)) {
      const result = validateSkill(REPO_ROOT, skill.name);
      expect(result.valid, `${skill.name}: ${result.errors.join("; ")}`).toBe(
        true,
      );
    }
  });

  it("agentRegistry skills match frontmatter projection", () => {
    expect(() => assertAgentRegistryMatchesSkills(REPO_ROOT)).not.toThrow();
  });

  it("engineering-lead receives scoped skills only", () => {
    const names = resolveSkillNamesForAgent(REPO_ROOT, "engineering-lead");
    expect(names).toContain("grill-me-with-docs");
    expect(names).toContain("code-review");
    expect(names).not.toContain("security-review");
  });

  it("qa-engineer receives review skills only", () => {
    const names = resolveSkillNamesForAgent(REPO_ROOT, "qa-engineer");
    expect(names).toEqual(["code-review", "security-review"]);
  });

  it("authority invariant: promote in allowed-tools blocks qa injection", () => {
    const skill = loadSkillRegistrationSync(REPO_ROOT, "code-review");
    const overPrivileged: typeof skill = {
      ...skill,
      allowedTools: [...skill.allowedTools, "promote"],
    };
    expect(canInjectSkill(overPrivileged, "qa-engineer")).toBe(false);
    expect(canInjectSkill(overPrivileged, "engineering-lead")).toBe(true);
  });

  it("QA never gets authoring skills (vacuous until Slice 4 bundles exist)", () => {
    expect(qaNeverGetsAuthoringSkills(REPO_ROOT)).toBe(true);
  });

  it("shared scope projects to all mastra agents", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-scope-"));
    const skillsDir = join(dir, "skills", "shared-fixture");
    try {
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(
        join(skillsDir, "SKILL.md"),
        `---
name: shared-fixture
description: Shared test skill for scope projection.
metadata:
  scope: shared
  allowed-tools: [review-build]
  allowed-workflows: []
  status: active
  tags: [test]
---
# Shared fixture
`,
      );
      const el = resolveSkillNamesForAgent(dir, "engineering-lead");
      const qa = resolveSkillNamesForAgent(dir, "qa-engineer");
      expect(el).toContain("shared-fixture");
      expect(qa).toContain("shared-fixture");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validation flags bad name and over-long description", () => {
    const badName = validateSkillMetadata(
      { name: "Bad_Name", description: "ok" },
      "Bad_Name",
    );
    expect(badName.valid).toBe(false);

    const longDesc = validateSkillMetadata({
      name: "x",
      description: "a".repeat(SKILL_LIMITS.MAX_DESCRIPTION_LENGTH + 1),
    });
    expect(longDesc.valid).toBe(false);
  });

  it("validation flags missing description", () => {
    const result = validateSkillMetadata({ name: "my-skill" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("description"))).toBe(true);
  });

  it("validation flags unknown allowed-tool", () => {
    const skill = loadSkillRegistrationSync(REPO_ROOT, "ship");
    const bad = validateSkillRegistration({
      ...skill,
      allowedTools: ["not-a-real-tool"],
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => e.includes("unknown tool"))).toBe(true);
  });

  it("resolveSkillsForAgent returns existing bundle paths", () => {
    const paths = resolveSkillsForAgent(REPO_ROOT, "engineering-lead");
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p).toMatch(/skills\/[^/]+$/);
    }
  });
});
