import type { ObservabilityCorrelation } from "../observability/observabilityEvent.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";

export const SKILL_TELEMETRY_EVENTS = [
  "skill.activated",
  "skill.tool_invoked",
  "skill.validated",
  "skill.changed",
  "skill.activation_failed",
] as const;

export type SkillTelemetryEvent = (typeof SKILL_TELEMETRY_EVENTS)[number];

export type SkillTelemetry = {
  activated: (
    skillName: string,
    agentId: string,
    correlation?: ObservabilityCorrelation,
  ) => void;
  toolInvoked: (
    skillName: string,
    toolId: string,
    options?: { mocked?: boolean; correlation?: ObservabilityCorrelation },
  ) => void;
  validated: (
    skillName: string,
    valid: boolean,
    errors: string[],
    correlation?: ObservabilityCorrelation,
  ) => void;
  changed: (
    skillName: string,
    action: string,
    status?: string,
    correlation?: ObservabilityCorrelation,
  ) => void;
  activationFailed: (
    skillName: string,
    agentId: string,
    reason: string,
    correlation?: ObservabilityCorrelation,
  ) => void;
};

export function createSkillTelemetry(
  observability: ObservabilityStore,
): SkillTelemetry {
  const emit = (
    event: SkillTelemetryEvent,
    correlation: ObservabilityCorrelation,
    data: Record<string, unknown>,
  ) => {
    observability.emit(event, correlation, data, "standard");
  };

  return {
    activated(skillName, agentId, correlation = {}) {
      emit("skill.activated", { ...correlation, agentId }, { skillName, agentId });
    },
    toolInvoked(skillName, toolId, options = {}) {
      emit(
        "skill.tool_invoked",
        options.correlation ?? {},
        {
          skillName,
          toolId,
          mocked: options.mocked ?? false,
        },
      );
    },
    validated(skillName, valid, errors, correlation = {}) {
      emit("skill.validated", correlation, { skillName, valid, errors });
    },
    changed(skillName, action, status, correlation = {}) {
      emit("skill.changed", correlation, { skillName, action, status });
    },
    activationFailed(skillName, agentId, reason, correlation = {}) {
      emit(
        "skill.activation_failed",
        { ...correlation, agentId },
        { skillName, agentId, reason },
      );
    },
  };
}
