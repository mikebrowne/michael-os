import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  buildVerificationVerdictSchema,
  type BuildVerificationVerdict,
} from "../../engineering/buildVerification.js";
import {
  runBuildVerification,
  type RunBuildVerificationOptions,
} from "../../engineering/buildVerificationRunner.js";

const runVerificationStep = createStep({
  id: "run-build-verification",
  description:
    "Run deterministic verification gates in fixed order (CI → code review → aggregate)",
  inputSchema: z.custom<RunBuildVerificationOptions>(),
  outputSchema: buildVerificationVerdictSchema,
  execute: async ({ inputData }) => runBuildVerification(inputData),
});

export const buildVerificationWorkflow = createWorkflow({
  id: "build-verification",
  inputSchema: z.custom<RunBuildVerificationOptions>(),
  outputSchema: buildVerificationVerdictSchema,
}).then(runVerificationStep);

buildVerificationWorkflow.commit();

export async function runBuildVerificationWorkflow(
  input: RunBuildVerificationOptions,
): Promise<BuildVerificationVerdict> {
  const run = await buildVerificationWorkflow.createRun();
  const result = await run.start({ inputData: input });
  if (result.status !== "success" || !result.result) {
    throw new Error(`Build verification workflow failed: ${result.status}`);
  }
  return buildVerificationVerdictSchema.parse(result.result);
}
