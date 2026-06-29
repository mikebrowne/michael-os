import type { ObservabilityStore } from "../observability/observabilityStore.js";
import type { RunLogger } from "../logging/runLogger.js";

export type BuildTelemetry = {
  logSessionStarted: (data: Record<string, unknown>) => void;
  logPlanCaptured: (data: Record<string, unknown>) => void;
  logSliceDispatched: (data: Record<string, unknown>) => void;
  logSliceVerified: (data: Record<string, unknown>) => void;
  logInterrupted: (data: Record<string, unknown>) => void;
  logResumed: (data: Record<string, unknown>) => void;
  logClarification: (data: Record<string, unknown>) => void;
};

export function createBuildTelemetry(
  observability: ObservabilityStore,
  runLogger?: RunLogger,
): BuildTelemetry {
  const log = (event: string, data: Record<string, unknown>) => {
    observability.emit(event, {}, data, "standard");
    if (runLogger) {
      runLogger.log({
        runId: observability.sessionId,
        event,
        data,
      });
    }
  };

  return {
    logSessionStarted: (data) => log("build.session_started", data),
    logPlanCaptured: (data) => log("build.plan_captured", data),
    logSliceDispatched: (data) => log("build.slice_dispatched", data),
    logSliceVerified: (data) => log("build.slice_verified", data),
    logInterrupted: (data) => log("build.interrupted", data),
    logResumed: (data) => log("build.resumed", data),
    logClarification: (data) => log("build.clarification", data),
  };
}
