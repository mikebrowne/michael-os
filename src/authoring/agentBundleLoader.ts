import type { Mastra } from "@mastra/core/mastra";
import type { Agent } from "@mastra/core/agent";
import {
  discoverAgentBundlesSync,
  type AgentBundleRegistration,
} from "./agentBundleRegistry.js";

export type AgentBundleLoaderOptions = {
  repoRoot: string;
  mastra: Mastra;
  instantiateAgent: (bundle: AgentBundleRegistration) => Agent;
};

/**
 * Thin Mastra wrapper: scan committed bundles and register via addAgent.
 * Startup scan is authoritative; controlled restart re-scans (reliable baseline).
 */
export function loadAgentBundlesFromDisk(
  options: AgentBundleLoaderOptions,
): string[] {
  const bundles = discoverAgentBundlesSync(options.repoRoot).filter(
    (b) => b.status === "active",
  );
  const loaded: string[] = [];

  for (const bundle of bundles) {
    if (bundle.kind !== "mastra-agent") continue;
    const agent = options.instantiateAgent(bundle);
    options.mastra.addAgent(agent, bundle.id, { source: "code" });
    loaded.push(bundle.id);
  }

  return loaded;
}
