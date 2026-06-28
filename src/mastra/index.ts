import { loadConfig } from "../config/loadConfig.js";
import { createMastraHarness } from "./mastraHarness.js";

const harness = createMastraHarness(loadConfig());

export const {
  config,
  mastra,
  observabilityStore,
  jobRegistry,
  jobRunner,
  runLogger,
  codeReviewerAgent,
  engineeringLeadAgent,
  engineeringSession,
  agentRegistry,
  memory,
} = harness;
