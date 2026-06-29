import type { ToolHooks } from "@mastra/core/tools";
import type { SkillTelemetry } from "./skillTelemetry.js";
import {
  canInjectSkill,
  loadSkillRegistrationSync,
} from "./skillRegistry.js";

export type SkillActivationHooksOptions = {
  repoRoot: string;
  agentId: string;
  skillTelemetry: SkillTelemetry;
};

export function createSkillActivationHooks(
  options: SkillActivationHooksOptions,
): ToolHooks {
  const { repoRoot, agentId, skillTelemetry } = options;

  return {
    beforeToolCall: async (context) => {
      if (context.toolName !== "skill") {
        return;
      }
      const input = context.input as { name?: string };
      const skillName = input?.name;
      if (!skillName) {
        return;
      }
      let skill;
      try {
        skill = loadSkillRegistrationSync(repoRoot, skillName);
      } catch {
        skillTelemetry.activationFailed(
          skillName,
          agentId,
          "skill bundle not found",
        );
        return {
          proceed: false,
          output: `Skill "${skillName}" not found.`,
        };
      }
      if (!canInjectSkill(skill, agentId)) {
        skillTelemetry.activationFailed(
          skillName,
          agentId,
          "out of scope or exceeds agent authority",
        );
        return {
          proceed: false,
          output: `Skill "${skillName}" is not available for this agent.`,
        };
      }
    },
    afterToolCall: async (context) => {
      if (context.toolName !== "skill" || context.error) {
        return;
      }
      const input = context.input as { name?: string };
      const skillName = input?.name;
      if (!skillName) return;
      skillTelemetry.activated(skillName, agentId);
    },
  };
}
