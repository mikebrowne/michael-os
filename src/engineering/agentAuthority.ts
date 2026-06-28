import { getAgent } from "../mastra/agentRegistry.js";
import type { AgentAuthority } from "../mastra/agentRegistry.js";

export type { AgentAuthority } from "../mastra/agentRegistry.js";

export const MANAGEMENT_TOOL_IDS = new Set([
  "run-build",
  "ship-docs",
  "ship-implementation",
]);

export function isManagementTool(toolId: string): boolean {
  return MANAGEMENT_TOOL_IDS.has(toolId);
}

export function canAgentUseTool(
  authority: AgentAuthority,
  toolId: string,
): boolean {
  if (!isManagementTool(toolId)) {
    return true;
  }
  return authority === "management";
}

export function filterToolsByAuthority<T extends Record<string, unknown>>(
  tools: T,
  authority: AgentAuthority,
): Partial<T> {
  const filtered: Partial<T> = {};
  for (const [id, tool] of Object.entries(tools)) {
    if (canAgentUseTool(authority, id)) {
      (filtered as Record<string, unknown>)[id] = tool;
    }
  }
  return filtered;
}

export function getAgentAuthority(agentId: string): AgentAuthority {
  return getAgent(agentId)?.authority ?? "employee";
}
