import type { ApprovalState } from "../engineering/approvalGate.js";
import {
  consumeApproval,
  needsApprovalMessage,
} from "../engineering/approvalGate.js";
import { logApprovalAudit } from "../engineering/approvalAudit.js";
import type { EngineeringTelemetry } from "../engineering/engineeringTelemetry.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";
import type { ActivationCategory } from "./authoringTypes.js";

/**
 * Future trust policy hook (Phase 14). Phase 7 hardwires `alwaysAskTrustPolicy`.
 * A single injection point — loosen without re-plumbing the seam.
 */
export type TrustPolicy = {
  canAutoApprove(
    category: ActivationCategory,
    artifactId: string,
    context?: Record<string, unknown>,
  ): boolean;
};

export const alwaysAskTrustPolicy: TrustPolicy = {
  canAutoApprove: () => false,
};

export type ActivationRequest = {
  category: ActivationCategory;
  artifactId: string;
  reason?: string;
  context?: Record<string, unknown>;
};

export type ActivationSeamResult =
  | { approved: true; autoApproved: boolean; approvalKey: string }
  | { approved: false; needsApproval: true; approvalKey: string; message: string };

export function activationApprovalKey(
  category: ActivationCategory,
  artifactId: string,
): string {
  return `activate:${category}:${artifactId}`;
}

export function activationApprovalMessage(
  category: ActivationCategory,
  artifactId: string,
): string {
  return `Activation of ${category} "${artifactId}" requires your approval. Reply YES to activate or NO to cancel.`;
}

/**
 * Single checkpoint every "activate" routes through.
 * Uses custom approval keys (not DANGEROUS_TOOL_IDS) via direct pending/granted state.
 */
export function requestActivationApproval(
  approval: ApprovalState,
  request: ActivationRequest,
  trustPolicy: TrustPolicy = alwaysAskTrustPolicy,
): ActivationSeamResult {
  const key = activationApprovalKey(request.category, request.artifactId);

  if (trustPolicy.canAutoApprove(request.category, request.artifactId, request.context)) {
    return { approved: true, autoApproved: true, approvalKey: key };
  }

  if (consumeApproval(approval, key)) {
    return { approved: true, autoApproved: false, approvalKey: key };
  }

  approval.pending = {
    toolId: key,
    args: {
      category: request.category,
      artifactId: request.artifactId,
      reason: request.reason,
      ...request.context,
    },
  };

  return {
    approved: false,
    needsApproval: true,
    approvalKey: key,
    message: `${activationApprovalMessage(request.category, request.artifactId)} ${needsApprovalMessage(key)}`,
  };
}

export function logActivationAudit(
  observability: ObservabilityStore,
  telemetry: EngineeringTelemetry,
  context: {
    category: ActivationCategory;
    artifactId: string;
    approved: boolean;
    autoApproved?: boolean;
    workItemSlug?: string;
    issueNumber?: number;
  },
): void {
  const key = activationApprovalKey(context.category, context.artifactId);
  logApprovalAudit(observability, telemetry, {
    toolId: key,
    approved: context.approved,
    workItemSlug: context.workItemSlug,
    issueNumber: context.issueNumber,
    args: {
      category: context.category,
      artifactId: context.artifactId,
      autoApproved: context.autoApproved ?? false,
    },
  });
}
