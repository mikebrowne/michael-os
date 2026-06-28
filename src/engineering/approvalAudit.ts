import type { EngineeringTelemetry } from "./engineeringTelemetry.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";

export type ApprovalAuditContext = {
  toolId: string;
  approved: boolean;
  workItemSlug?: string;
  issueNumber?: number;
  args?: Record<string, unknown>;
};

export function logApprovalAudit(
  observability: ObservabilityStore,
  telemetry: EngineeringTelemetry,
  context: ApprovalAuditContext,
): void {
  const event = context.approved ? "approval.granted" : "approval.denied";
  observability.emit(
    event,
    {
      workItemSlug: context.workItemSlug,
      issueNumber: context.issueNumber,
    },
    {
      toolId: context.toolId,
      approved: context.approved,
      args: context.args,
    },
    "standard",
  );
  telemetry.logApprovalDecision(context.approved, context.toolId, context);
}
