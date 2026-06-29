import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { RequestContext } from "@mastra/core/request-context";
import { isSkillTestMode } from "../../../skills/skillTestMode.js";
import {
  executeFixtureSideEffect,
  FIXTURE_SIDE_EFFECT_MOCK,
} from "../../../skills/skillEvalRunner.js";
import type { SkillTelemetry } from "../../../skills/skillTelemetry.js";

export function createFixtureSideEffectTool(options: {
  sideEffectPath: string;
  skillTelemetry?: SkillTelemetry;
}) {
  return createTool({
    id: "fixture-side-effect",
    description:
      "Test-only side-effecting tool; returns mock under skill testMode.",
    inputSchema: z.object({
      skillName: z.string().optional(),
    }),
    execute: async (input, context) => {
      const testMode = isSkillTestMode(
        context?.requestContext as RequestContext | undefined,
      );
      return executeFixtureSideEffect(
        {
          sideEffectPath: options.sideEffectPath,
          skillTelemetry: options.skillTelemetry,
          skillName: input.skillName ?? "fixture",
        },
        testMode,
      );
    },
  });
}

export { FIXTURE_SIDE_EFFECT_MOCK };
