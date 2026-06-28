import { Mastra } from "@mastra/core/mastra";
import { EventEmitterPubSub } from "@mastra/core/events";
import { PinoLogger } from "@mastra/loggers";
import { loadConfig } from "../config/loadConfig.js";
import { createRunLogger } from "../logging/runLogger.js";
import { createEngineeringSessionContext } from "../engineering/sessionContext.js";
import { createObservabilityStore } from "../observability/observabilityStore.js";
import { createObservabilityConfig } from "../observability/observabilityConfig.js";
import { createJobRegistry } from "../engineering/jobRegistry.js";
import { createJobRunner } from "../engineering/jobRunner.js";
import { demoAgent } from "./agents/demo-agent.js";
import { createEngineeringLeadAgent } from "./agents/engineering-lead.js";
import { createCodeReviewerAgent } from "./agents/code-reviewer.js";
import { demoWorkflow } from "./workflows/demo-workflow.js";
import { listAgents } from "./agentRegistry.js";
import { createMastraStorage } from "./mastraStorage.js";
import { createAgentMemory } from "./agentMemory.js";

const config = loadConfig();

export const runLogger = createRunLogger({
  logDir: config.logDir,
  logLevel: config.logLevel,
  name: config.appName,
});

export const observabilityStore = createObservabilityStore({
  logDir: config.logDir,
  mastraDir: config.mastraDir,
  config: createObservabilityConfig({ level: config.observabilityLevel }),
});

export const jobRegistry = createJobRegistry(config.mastraDir);

const storage = createMastraStorage();
const memory = createAgentMemory(process.cwd(), storage);

const engineeringSession = createEngineeringSessionContext(config, {
  observability: observabilityStore,
  jobRegistry,
});

export const codeReviewerAgent = createCodeReviewerAgent(
  config.defaultReviewModel,
  process.cwd(),
);

export const engineeringLeadAgent = createEngineeringLeadAgent(
  config.defaultModel,
  engineeringSession,
  process.cwd(),
  codeReviewerAgent,
);

export const jobRunner = createJobRunner({
  jobRegistry,
  observability: observabilityStore,
});

engineeringSession.jobRunner = jobRunner;

export const agentRegistry = listAgents();

export const mastra = new Mastra({
  agents: { demoAgent, engineeringLeadAgent, codeReviewerAgent },
  workflows: { demoWorkflow },
  storage,
  pubsub: new EventEmitterPubSub(),
  backgroundTasks: {
    enabled: true,
    globalConcurrency: 1,
    perAgentConcurrency: 1,
    backpressure: "queue",
  },
  logger: new PinoLogger({
    name: config.appName,
    level: config.logLevel,
  }),
});

jobRunner.setBackgroundTaskManager(mastra.backgroundTaskManager);

export { config, memory, engineeringSession };
