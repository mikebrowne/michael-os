import type { RunLogger } from "../logging/runLogger.js";
import { randomUUID } from "node:crypto";
import { listAgents } from "../mastra/agentRegistry.js";

export type EngineeringTelemetry = {
  logAgentInvoked: (agentId: string, role: string, modelTier: string) => void;
  logReviewVerdict: (
    decision: string,
    findingCount: number,
    agentId?: string,
  ) => void;
  logRegistryLoaded: () => void;
  logShipDecision: (approved: boolean, toolId: string) => void;
};

export function createEngineeringTelemetry(
  runLogger?: RunLogger,
): EngineeringTelemetry {
  const sessionId = randomUUID();

  const log = (event: string, data: Record<string, unknown>) => {
    runLogger?.log({
      runId: sessionId,
      event,
      data,
    });
  };

  return {
    logAgentInvoked(agentId, role, modelTier) {
      log("agent.invoked", { agentId, role, modelTier });
    },
    logReviewVerdict(decision, findingCount, agentId = "code-reviewer") {
      log("review.verdict", { agentId, decision, findingCount });
    },
    logRegistryLoaded() {
      log("registry.loaded", {
        agents: listAgents().map((a) => ({ id: a.id, role: a.role, kind: a.kind })),
      });
    },
    logShipDecision(approved, toolId) {
      log("ship.decision", { approved, toolId });
    },
  };
}
