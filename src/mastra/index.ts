import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { loadConfig } from "../config/loadConfig.js";
import { createRunLogger } from "../logging/runLogger.js";
import { createEngineeringSessionContext } from "../engineering/sessionContext.js";
import { demoAgent } from "./agents/demo-agent.js";
import { createEngineeringLeadAgent } from "./agents/engineering-lead.js";
import { demoWorkflow } from "./workflows/demo-workflow.js";

const config = loadConfig();

export const runLogger = createRunLogger({
  logDir: config.logDir,
  logLevel: config.logLevel,
  name: config.appName,
});

const engineeringSession = createEngineeringSessionContext(config);

export const engineeringLeadAgent = createEngineeringLeadAgent(
  config.defaultModel,
  engineeringSession,
);

export const mastra = new Mastra({
  agents: { demoAgent, engineeringLeadAgent },
  workflows: { demoWorkflow },
  logger: new PinoLogger({
    name: config.appName,
    level: config.logLevel,
  }),
});

export { config };
