import type { GateFinding } from "../engineering/buildVerification.js";
import {
  createRemediationState,
  isRemediationCapReached,
  recordRemediationAttempt,
  type RemediationState,
} from "../engineering/remediation.js";

export type AuthoringAttemptState = RemediationState;

export function createAuthoringAttemptState(cap: number): AuthoringAttemptState {
  return createRemediationState(cap);
}

export function recordAuthoringAttempt(
  state: AuthoringAttemptState,
  findings: GateFinding[] = [],
): AuthoringAttemptState {
  return recordRemediationAttempt(state, findings);
}

export function isAuthoringCapReached(state: AuthoringAttemptState): boolean {
  return isRemediationCapReached(state);
}

export type AuthoringCapEscalation = {
  blocked: true;
  attemptCount: number;
  cap: number;
  message: string;
};

export function escalateAtAuthoringCap(
  state: AuthoringAttemptState,
  context?: string,
): AuthoringCapEscalation {
  return {
    blocked: true,
    attemptCount: state.attemptCount,
    cap: state.cap,
    message: `Autonomous authoring cap (${state.cap}) reached${context ? `: ${context}` : ""}. Hard-stopped — escalate to operator.`,
  };
}
