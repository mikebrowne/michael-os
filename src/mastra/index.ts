import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { loadConfig } from "../config/loadConfig.js";
import { createRunLogger } from "../logging/runLogger.js";
import { demoAgent } from "./agents/demo-agent.js";
import { demoWorkflow } from "./workflows/demo-workflow.js";

const config = loadConfig();

export const runLogger = createRunLogger({
  logDir: config.logDir,
  logLevel: config.logLevel,
  name: config.appName,
});

export const mastra = new Mastra({
  agents: { demoAgent },
  workflows: { demoWorkflow },
  logger: new PinoLogger({
    name: config.appName,
    level: config.logLevel,
  }),
});

export { config };
