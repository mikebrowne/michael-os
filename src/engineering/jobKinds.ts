import { z } from "zod";
import { reviewVerdictSchema } from "../engineering/review.js";

export const JOB_KINDS = ["code-review"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(JOB_KINDS),
  parentWorkItem: z.string(),
  issueNumber: z.number().optional(),
  delegatedTo: z.string(),
  status: jobStatusSchema,
  input: z.record(z.string(), z.unknown()),
  output: z.unknown().optional(),
  error: z.string().optional(),
  mastraRunId: z.string().optional(),
  mastraTaskId: z.string().optional(),
  traceId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type JobRecord = z.infer<typeof jobRecordSchema>;

export const jobOutputSchemas: Record<JobKind, z.ZodType> = {
  "code-review": reviewVerdictSchema,
};

export function validateJobOutput(kind: JobKind, output: unknown): unknown {
  return jobOutputSchemas[kind].parse(output);
}

export type CodeReviewJobInput = {
  workItemSlug: string;
  issueNumber?: number;
  buildRunDir?: string;
  acceptanceHash?: string;
};
