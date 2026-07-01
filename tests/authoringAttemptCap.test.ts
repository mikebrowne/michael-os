import { describe, expect, it } from "vitest";
import {
  createAuthoringAttemptState,
  escalateAtAuthoringCap,
  isAuthoringCapReached,
  recordAuthoringAttempt,
} from "../src/authoring/authoringAttemptCap.js";

describe("authoring attempt cap", () => {
  it("hard-stops and escalates at the cap", () => {
    let state = createAuthoringAttemptState(2);
    state = recordAuthoringAttempt(state);
    expect(isAuthoringCapReached(state)).toBe(false);
    state = recordAuthoringAttempt(state);
    expect(isAuthoringCapReached(state)).toBe(true);
    const escalation = escalateAtAuthoringCap(state, "proposal drafting");
    expect(escalation.blocked).toBe(true);
    expect(escalation.message).toContain("cap (2) reached");
  });
});
