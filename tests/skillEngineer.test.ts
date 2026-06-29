import { describe, expect, it } from "vitest";
import { getAgent } from "../src/mastra/agentRegistry.js";
import {
  canAgentUseTool,
  isManagementTool,
} from "../src/engineering/agentAuthority.js";
import {
  qaNeverGetsAuthoringSkills,
  resolveSkillNamesForAgent,
  AUTHORING_SKILL_NAMES,
} from "../src/skills/skillRegistry.js";
import { createSkillEngineerSessionContext } from "../src/skills/skillEngineerSession.js";
import { createSkillEngineerTools } from "../src/mastra/tools/skillEngineer/index.js";
import { buildCreateIssueCommand } from "../src/engineering/github.js";
import { loadConfig } from "../src/config/loadConfig.js";
import {
  detectNewDangerousAllowedTools,
  skillChangeApprovalKey,
} from "../src/skills/skillLifecycle.js";
import { grantPendingApproval, createApprovalState } from "../src/engineering/approvalGate.js";

const REPO_ROOT = process.cwd();

describe("skillEngineer", () => {
  it("is registered as employee with directChat", () => {
    const se = getAgent("skill-engineer");
    expect(se?.authority).toBe("employee");
    expect(se?.directChat).toBe(true);
    expect(se?.standalone).toBe(true);
  });

  it("employee clearance: cannot use management tools", () => {
    for (const toolId of ["promote", "rollback", "restart"]) {
      expect(canAgentUseTool("employee", toolId)).toBe(false);
      expect(isManagementTool(toolId)).toBe(true);
    }
  });

  it("QA never gets authoring skills", () => {
    expect(qaNeverGetsAuthoringSkills(REPO_ROOT)).toBe(true);
    const qaSkills = resolveSkillNamesForAgent(REPO_ROOT, "qa-engineer");
    for (const name of AUTHORING_SKILL_NAMES) {
      expect(qaSkills).not.toContain(name);
    }
    const seSkills = resolveSkillNamesForAgent(REPO_ROOT, "skill-engineer");
    expect(seSkills).toContain("write-skill");
    expect(seSkills).toContain("skill-eval-design");
  });

  it("request-tool-build builds gh issue create command", () => {
    const cmd = buildCreateIssueCommand("owner/repo", {
      title: "[tool-build] Add CRM tool",
      body: "Need a tool",
      labels: ["tool-build"],
    });
    expect(cmd).toContain("issue");
    expect(cmd).toContain("create");
    expect(cmd.join(" ")).toContain("tool-build");
  });

  it("dangerous allowed-tools declaration requires approval key", () => {
    const added = detectNewDangerousAllowedTools([], ["promote"]);
    expect(added).toEqual(["promote"]);
    const state = createApprovalState();
    state.pending = {
      toolId: skillChangeApprovalKey("my-skill"),
      args: {},
    };
    expect(grantPendingApproval(state)).toBe(true);
  });

  it("ordinary edit tool does not require dangerous approval path", async () => {
    const config = loadConfig();
    const ctx = createSkillEngineerSessionContext(config, { repoPath: REPO_ROOT });
    const tools = createSkillEngineerTools(ctx);
    const result = (await tools.validateSkillTool.execute!(
      { name: "ship" },
      {} as never,
    )) as { valid: boolean };
    expect(result.valid).toBe(true);
  });
});
