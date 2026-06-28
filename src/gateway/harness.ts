import type { EngineeringSessionContext } from "../engineering/sessionContext.js";
import type { JobRegistry } from "../engineering/jobRegistry.js";
import type { JobRunner } from "../engineering/jobRunner.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";

export type HarnessServices = {
  observability: ObservabilityStore;
  jobRegistry: JobRegistry;
  jobRunner: JobRunner;
};

export function attachHarnessServices(
  ctx: EngineeringSessionContext,
  services: HarnessServices,
): EngineeringSessionContext {
  ctx.observability = services.observability;
  ctx.jobRegistry = services.jobRegistry;
  ctx.jobRunner = services.jobRunner;
  return ctx;
}
