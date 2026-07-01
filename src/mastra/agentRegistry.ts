import { discoverActiveAgentBundlesSync } from "../authoring/agentBundleRegistry.js";
import type {
  AgentRegistration,
  AgentAuthority,
  AgentKind,
} from "./agentRegistration.js";

export type { AgentRegistration, AgentAuthority, AgentKind };

let cachedRepoRoot: string | undefined;
let cachedRegistry: AgentRegistration[] | undefined;

function resolveRegistry(repoRoot: string = process.cwd()): AgentRegistration[] {
  if (cachedRepoRoot === repoRoot && cachedRegistry) {
    return cachedRegistry;
  }
  cachedRepoRoot = repoRoot;
  cachedRegistry = discoverActiveAgentBundlesSync(repoRoot);
  return cachedRegistry;
}

/** Reset derived cache (tests). */
export function resetAgentRegistryCache(): void {
  cachedRepoRoot = undefined;
  cachedRegistry = undefined;
}

export function listAgents(repoRoot?: string): AgentRegistration[] {
  return [...resolveRegistry(repoRoot)];
}

export function getAgent(
  id: string,
  repoRoot?: string,
): AgentRegistration | undefined {
  return resolveRegistry(repoRoot).find((a) => a.id === id);
}

export function listMastraAgents(repoRoot?: string): AgentRegistration[] {
  return resolveRegistry(repoRoot).filter((a) => a.kind === "mastra-agent");
}
