import { z } from "zod";

export const OBSERVABILITY_EVENT_VERSION = 1;

export const correlationSchema = z.object({
  traceId: z.string().optional(),
  sessionId: z.string().optional(),
  workItemSlug: z.string().optional(),
  issueNumber: z.number().optional(),
  jobId: z.string().optional(),
  mastraRunId: z.string().optional(),
  agentId: z.string().optional(),
});

export type ObservabilityCorrelation = z.infer<typeof correlationSchema>;

export type ObservabilityEvent = {
  version: typeof OBSERVABILITY_EVENT_VERSION;
  event: string;
  timestamp: string;
  correlation: ObservabilityCorrelation;
  data?: Record<string, unknown>;
};

export function createObservabilityEvent(
  event: string,
  correlation: ObservabilityCorrelation,
  data?: Record<string, unknown>,
): ObservabilityEvent {
  return {
    version: OBSERVABILITY_EVENT_VERSION,
    event,
    timestamp: new Date().toISOString(),
    correlation,
    data,
  };
}
