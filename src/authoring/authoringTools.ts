import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { ApprovalState } from "../engineering/approvalGate.js";
import type { GhRunner } from "../engineering/github.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";
import type { EngineeringTelemetry } from "../engineering/engineeringTelemetry.js";
import { draftAuthoringProposal } from "./authoringProposal.js";
import type { AuthoringForm } from "./authoringTypes.js";
import {
  requestActivationApproval,
  logActivationAudit,
  type TrustPolicy,
} from "./authoringApprovalSeam.js";
import {
  createAuthoringAttemptState,
  recordAuthoringAttempt,
  isAuthoringCapReached,
  escalateAtAuthoringCap,
} from "./authoringAttemptCap.js";

export type AuthoringToolsContext = {
  repoPath: string;
  githubRepo: string;
  ghRunner: GhRunner;
  approval: ApprovalState;
  observability: ObservabilityStore;
  telemetry: EngineeringTelemetry;
  authoringCap: number;
  trustPolicy?: TrustPolicy;
  proposalsEnabled?: boolean;
};

export function createAuthoringTools(ctx: AuthoringToolsContext) {
  let attemptState = createAuthoringAttemptState(ctx.authoringCap);

  const proposeExtension = createTool({
    id: "propose-extension",
    description:
      "Draft a backlog GitHub Issue proposing a self-extension (user story + technical + non-technical detail) before building.",
    inputSchema: z.object({
      title: z.string(),
      userStory: z.string(),
      technicalDetail: z.string(),
      nonTechnicalDetail: z.string(),
      recommendedForm: z.enum(["skill", "tool", "workflow", "agent"]),
      rationale: z.string(),
      labels: z.array(z.string()).optional(),
    }),
    execute: async (input) => {
      if (ctx.proposalsEnabled === false) {
        return {
          blocked: true,
          message: "Autonomous proposals disabled (AUTHORING_PROPOSALS_ENABLED=false).",
        };
      }

      attemptState = recordAuthoringAttempt(attemptState);
      if (isAuthoringCapReached(attemptState)) {
        return escalateAtAuthoringCap(attemptState, "proposal drafting");
      }

      const result = await draftAuthoringProposal(ctx.ghRunner, ctx.githubRepo, {
        ...input,
        recommendedForm: input.recommendedForm as AuthoringForm,
      });

      ctx.observability.emit(
        "authoring.proposed",
        {},
        {
          title: result.title,
          issueNumber: result.issueNumber,
          form: input.recommendedForm,
        },
        "standard",
      );

      return {
        ...result,
        message: `Proposal drafted: ${result.urlHint}. Review the backlog Issue before building.`,
      };
    },
  });

  const requestActivation = createTool({
    id: "request-activation",
    description:
      "Request operator activation for a self-authored artifact through the single approval seam.",
    inputSchema: z.object({
      category: z.enum(["skill", "tool", "workflow", "agent"]),
      artifactId: z.string(),
      reason: z.string().optional(),
    }),
    execute: async (input) => {
      const seam = requestActivationApproval(
        ctx.approval,
        {
          category: input.category,
          artifactId: input.artifactId,
          reason: input.reason,
        },
        ctx.trustPolicy,
      );

      if (!seam.approved) {
        ctx.observability.emit(
          "approval.requested",
          {},
          {
            approvalKey: seam.approvalKey,
            category: input.category,
            artifactId: input.artifactId,
          },
          "standard",
        );
        return { needsApproval: true, message: seam.message, approvalKey: seam.approvalKey };
      }

      logActivationAudit(ctx.observability, ctx.telemetry, {
        category: input.category,
        artifactId: input.artifactId,
        approved: true,
        autoApproved: seam.autoApproved,
      });

      return {
        activated: true,
        autoApproved: seam.autoApproved,
        message: `${input.category} "${input.artifactId}" activation approved.`,
      };
    },
  });

  return { proposeExtension, requestActivation, getAttemptState: () => attemptState };
}
