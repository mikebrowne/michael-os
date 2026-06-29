import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgent } from "../src/mastra/agentRegistry.js";
import { discoverSkillsSync } from "../src/skills/skillRegistry.js";
import { resolveSkillsForAgent } from "../src/skills/skillRegistry.js";
import {
  SKILL_TELEMETRY_EVENTS,
} from "../src/skills/skillTelemetry.js";
import {
  SKILL_TEST_MODE_KEY,
} from "../src/skills/skillTestMode.js";

const REPO_ROOT = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(REPO_ROOT, "package.json"), "utf-8"),
) as { scripts: Record<string, string> };

/**
 * Consolidation checklist for Phase 6 deterministic north-star buckets.
 * Detailed behavior is covered in slice-specific suites; this file guards regressions
 * on the locked vocabulary and invariants.
 */
describe("phase 6 north star consolidation", () => {
  it("discovers at least 7 active skills and skillLoader is retired", () => {
    const skills = discoverSkillsSync(REPO_ROOT);
    expect(skills.length).toBeGreaterThanOrEqual(7);
    expect(
      existsSync(join(REPO_ROOT, "src/skills/skillLoader.ts")),
    ).toBe(false);
  });

  it("QA Engineer never receives authoring skills", () => {
    const qaSkills = resolveSkillsForAgent(REPO_ROOT, "qa-engineer");
    const names = qaSkills.map((p) => p.split("/").slice(-2, -1)[0]);
    expect(names).not.toContain("write-skill");
    expect(names).not.toContain("skill-eval-design");
  });

  it("registers all five skill.* telemetry event names", () => {
    expect(SKILL_TELEMETRY_EVENTS).toEqual([
      "skill.activated",
      "skill.tool_invoked",
      "skill.validated",
      "skill.changed",
      "skill.activation_failed",
    ]);
  });

  it("skill-engineer is employee with directChat in agentRegistry", () => {
    const se = getAgent("skill-engineer");
    expect(se).toBeDefined();
    expect(se!.authority).toBe("employee");
    expect(se!.directChat).toBe(true);
    expect(se!.standalone).toBe(true);
  });

  it("eval:skills script and testMode key are exported", () => {
    expect(packageJson.scripts["eval:skills"]).toBe("tsx scripts/evalSkills.ts");
    expect(SKILL_TEST_MODE_KEY).toBe("testMode");
    expect(existsSync(join(REPO_ROOT, "scripts/evalSkills.ts"))).toBe(true);
  });

  it("code-review has a seed eval case under evals/", () => {
    const evalPath = join(
      REPO_ROOT,
      "skills/code-review/evals/basic-verdict-shape.json",
    );
    expect(existsSync(evalPath)).toBe(true);
    const evalCase = JSON.parse(readFileSync(evalPath, "utf-8")) as {
      input: string;
      expectedBehavior: string;
    };
    expect(evalCase.input).toBeTruthy();
    expect(evalCase.expectedBehavior).toBeTruthy();
  });
});
