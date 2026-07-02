import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import type { AppConfig } from "../config/loadConfig.js";
import { createRunLogger } from "../logging/runLogger.js";
import { createEngineeringSessionContext } from "../engineering/sessionContext.js";
import { createObservabilityStore } from "../observability/observabilityStore.js";
import { createObservabilityConfig } from "../observability/observabilityConfig.js";
import { createJobRegistry } from "../engineering/jobRegistry.js";
import { createJobRunner } from "../engineering/jobRunner.js";
import { demoAgent } from "./agents/demo-agent.js";
import { createEngineeringLeadAgent } from "./agents/engineering-lead.js";
import { createQaEngineerAgent } from "./agents/qa-engineer.js";
import { createSkillEngineerAgent } from "./agents/skill-engineer.js";
import { createEngagementManagerAgent } from "./agents/engagement-manager.js";
import { createSkillEngineerSessionContext } from "../skills/skillEngineerSession.js";
import { demoWorkflow } from "./workflows/demo-workflow.js";
import { buildVerificationWorkflow } from "./workflows/buildVerificationWorkflow.js";
import { listAgents } from "./agentRegistry.js";
import { createMastraStorage } from "./mastraStorage.js";
import { createAgentMemory } from "./agentMemory.js";

export type MastraHarness = {
  config: AppConfig;
  mastra: Mastra;
  observabilityStore: ReturnType<typeof createObservabilityStore>;
  jobRegistry: ReturnType<typeof createJobRegistry>;
  jobRunner: ReturnType<typeof createJobRunner>;
  runLogger: ReturnType<typeof createRunLogger>;
  qaEngineerAgent: ReturnType<typeof createQaEngineerAgent>;
  skillEngineerAgent: ReturnType<typeof createSkillEngineerAgent>;
  engagementManagerAgent: ReturnType<typeof createEngagementManagerAgent>;
  skillEngineerSession: ReturnType<typeof createSkillEngineerSessionContext>;
  engineeringLeadAgent: ReturnType<typeof createEngineeringLeadAgent>;
  engineeringSession: ReturnType<typeof createEngineeringSessionContext>;
  agentRegistry: ReturnType<typeof listAgents>;
  memory: ReturnType<typeof createAgentMemory>;
  storage: ReturnType<typeof createMastraStorage>;
};

export function createMastraHarness(
  config: AppConfig,
  repoPath: string = process.cwd(),
): MastraHarness {
  const runLogger = createRunLogger({
    logDir: config.logDir,
    logLevel: config.logLevel,
    name: config.appName,
  });

  const observabilityStore = createObservabilityStore({
    logDir: config.logDir,
    mastraDir: config.mastraDir,
    config: createObservabilityConfig({ level: config.observabilityLevel }),
  });

  const jobRegistry = createJobRegistry(config.mastraDir);

  const storage = createMastraStorage(repoPath);
  const memory = createAgentMemory(repoPath, storage);

  const engineeringSession = createEngineeringSessionContext(config, {
    observability: observabilityStore,
    jobRegistry,
    repoPath,
  });

  const qaEngineerAgent = createQaEngineerAgent(
    config.defaultReviewModel,
    repoPath,
  );

  const skillEngineerSession = createSkillEngineerSessionContext(config, {
    observability: observabilityStore,
    repoPath,
  });

  const skillEngineerAgent = createSkillEngineerAgent(
    config.defaultModel,
    skillEngineerSession,
    repoPath,
  );

  const engineeringLeadAgent = createEngineeringLeadAgent(
    config.defaultModel,
    engineeringSession,
    repoPath,
    qaEngineerAgent,
  );

  const engagementManagerAgent = createEngagementManagerAgent(
    config.defaultModel,
    engineeringSession,
    repoPath,
    engineeringLeadAgent,
    skillEngineerAgent,
  );

  const jobRunner = createJobRunner({
    jobRegistry,
    observability: observabilityStore,
    restartGate: engineeringSession.restartGate,
  });

  engineeringSession.jobRunner = jobRunner;

  const agentRegistry = listAgents();

  const mastra = new Mastra({
    agents: {
      demoAgent,
      engineeringLeadAgent,
      qaEngineerAgent,
      skillEngineerAgent,
      engagementManagerAgent,
    },
    workflows: { demoWorkflow, buildVerificationWorkflow },
    storage,
    logger: new PinoLogger({
      name: config.appName,
      level: config.logLevel,
    }),
  });

  return {
    config,
    mastra,
    observabilityStore,
    jobRegistry,
    jobRunner,
    runLogger,
    qaEngineerAgent,
    skillEngineerAgent,
    engagementManagerAgent,
    skillEngineerSession,
    engineeringLeadAgent,
    engineeringSession,
    agentRegistry,
    memory,
    storage,
  };
}
