import type { Agent } from "@mastra/core/agent";
import {
  createGatewayRouteState,
  listDirectChatAgentIds,
  loadGatewayRouteState,
  resolveDefaultGatewayAgentId,
  type GatewayRouteState,
} from "./gatewayRouteRegistry.js";
import type { GatewayAgents } from "./session.js";

export function buildGatewayAgentsMap(options: {
  engineeringLeadAgent: Agent;
  skillEngineerAgent: Agent;
  engagementManagerAgent: Agent;
  repoPath?: string;
}): GatewayAgents {
  const repoPath = options.repoPath ?? process.cwd();
  const map: GatewayAgents = {};
  const ids = listDirectChatAgentIds(repoPath);
  const byId: Record<string, Agent> = {
    "engineering-lead": options.engineeringLeadAgent,
    "skill-engineer": options.skillEngineerAgent,
    "engagement-manager": options.engagementManagerAgent,
  };
  for (const id of ids) {
    const agent = byId[id];
    if (agent) map[id] = agent;
  }
  return map;
}

export function initGatewayRouteState(
  repoPath: string,
  persist: boolean,
): GatewayRouteState {
  const defaultId = resolveDefaultGatewayAgentId(repoPath);
  if (persist) {
    return loadGatewayRouteState(repoPath, defaultId);
  }
  return createGatewayRouteState(defaultId);
}
