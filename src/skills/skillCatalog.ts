import { listAgents, listMastraAgents } from "../mastra/agentRegistry.js";

/** Skill Engineer lifecycle tools (Slice 4). */
export const SKILL_ENGINEER_TOOL_IDS = [
  "create-skill",
  "edit-skill",
  "validate-skill",
  "eval-skill",
  "deprecate-skill",
  "archive-skill",
  "request-tool-build",
  "activate-skill",
] as const;

/** Phase 7 authoring tools. */
export const AUTHORING_TOOL_IDS = [
  "propose-extension",
  "request-activation",
  "harden-skill-into-tool",
  "scaffold-workflow",
  "draft-agent-bundle",
  "onboard-agent-tool",
  "activate-agent",
] as const;

/** Registered Mastra workflow ids skills may declare. */
export const KNOWN_WORKFLOW_IDS = [
  "demo-vault-summary",
  "build-verification",
] as const;

export function collectKnownToolIds(): Set<string> {
  const ids = new Set<string>();
  for (const agent of listAgents()) {
    for (const toolId of agent.tools ?? []) {
      ids.add(toolId);
    }
  }
  for (const toolId of SKILL_ENGINEER_TOOL_IDS) {
    ids.add(toolId);
  }
  for (const toolId of AUTHORING_TOOL_IDS) {
    ids.add(toolId);
  }
  return ids;
}

export function collectKnownAgentIds(): Set<string> {
  return new Set(listAgents().map((a) => a.id));
}

export function listMastraAgentIds(): string[] {
  return listMastraAgents().map((a) => a.id);
}
