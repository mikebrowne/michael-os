import type { RunLogger } from "../logging/runLogger.js";
import { listAgents } from "../mastra/agentRegistry.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";

export type EngineeringTelemetry = {
  logAgentInvoked: (agentId: string, role: string, modelTier: string) => void;
  logReviewVerdict: (
    decision: string,
    findingCount: number,
    agentId?: string,
  ) => void;
  logRegistryLoaded: () => void;
  logShipDecision: (approved: boolean, toolId: string) => void;
  logReviewMissing: (workItemSlug: string, issueNumber?: number) => void;
  logApprovalDecision: (
    approved: boolean,
    toolId: string,
    context?: Record<string, unknown>,
  ) => void;
  logGateResult: (kind: string, status: string, workItemSlug?: string) => void;
  logPromotionEvent: (event: string, data: Record<string, unknown>) => void;
};

export function createEngineeringTelemetry(
  observability: ObservabilityStore,
  runLogger?: RunLogger,
): EngineeringTelemetry {
  const log = (event: string, data: Record<string, unknown>) => {
    const record = observability.emit(event, {}, data, "minimal");
    if (record && runLogger) {
      runLogger.log({
        runId: observability.sessionId,
        event,
        data,
      });
    }
  };

  return {
    logAgentInvoked(agentId, role, modelTier) {
      log("agent.invoked", { agentId, role, modelTier });
    },
    logReviewVerdict(decision, findingCount, agentId = "qa-engineer") {
      log("review.verdict", { agentId, decision, findingCount });
    },
    logRegistryLoaded() {
      log("registry.loaded", {
        agents: listAgents().map((a) => ({
          id: a.id,
          role: a.role,
          kind: a.kind,
          authority: a.authority,
        })),
      });
    },
    logShipDecision(approved, toolId) {
      log("ship.decision", { approved, toolId });
    },
    logReviewMissing(workItemSlug, issueNumber) {
      observability.emit(
        "review.missing",
        { workItemSlug, issueNumber },
        { workItemSlug, issueNumber },
        "standard",
      );
    },
    logApprovalDecision(approved, toolId, context = {}) {
      log(approved ? "approval.granted" : "approval.denied", {
        approved,
        toolId,
        ...context,
      });
    },
    logGateResult(kind, status, workItemSlug) {
      log("gate.result", { kind, status, workItemSlug });
    },
    logPromotionEvent(event, data) {
      log(`promotion.${event}`, data);
    },
  };
}
