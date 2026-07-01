import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import { loadConfig } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createGatewayRouteState } from "../src/gateway/gatewayRouteRegistry.js";
import {
  createGatewayRuntime,
  type GatewayRuntime,
} from "../src/gateway/session.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import type { EngineeringSessionContext } from "../src/engineering/sessionContext.js";
import type { AppConfig } from "../src/config/loadConfig.js";

export function createMockAgent(id: string): Agent {
  return {
    id,
    generate: async () => ({ text: "mock response" }),
  } as unknown as Agent;
}

export function createMockMemory(): Memory {
  return {
    getThreadById: async () => null,
    saveThread: async () => {},
    saveMessages: async () => {},
    updateWorkingMemory: async () => {},
  } as unknown as Memory;
}

export type TestGatewayHarness = {
  dir: string;
  config: AppConfig;
  ctx: EngineeringSessionContext;
  runtime: GatewayRuntime;
};

export async function createTestGatewayRuntime(options?: {
  activeAgentId?: string;
  extraCtx?: Partial<Parameters<typeof createEngineeringSessionContext>[1]>;
}): Promise<TestGatewayHarness> {
  const dir = mkdtempSync(join(tmpdir(), "michael-os-gw-"));
  const config = {
    ...loadConfig(),
    stateDir: join(dir, "state"),
    mastraDir: join(dir, ".mastra"),
    logDir: join(dir, "logs"),
  };
  const observability = createObservabilityStore({
    logDir: config.logDir,
    mastraDir: config.mastraDir,
    config: createObservabilityConfig({ level: "minimal" }),
  });
  const jobRegistry = createJobRegistry(config.mastraDir);
  const jobRunner = createJobRunner({ jobRegistry, observability });
  const ctx = createEngineeringSessionContext(config, {
    observability,
    jobRegistry,
    jobRunner,
    repoPath: process.cwd(),
    qaEngineerAgent: createMockAgent("qa-engineer"),
    ...options?.extraCtx,
  });

  const activeAgentId = options?.activeAgentId ?? "engineering-lead";
  const routeState = createGatewayRouteState(activeAgentId);
  routeState.threads["skill-engineer"] = "thread-skill-engineer";
  routeState.threads["engagement-manager"] = "thread-em";

  const runtime = await createGatewayRuntime({
    config,
    ctx,
    agents: {
      "engineering-lead": createMockAgent("engineering-lead"),
      "skill-engineer": createMockAgent("skill-engineer"),
      "engagement-manager": createMockAgent("engagement-manager"),
    },
    routeState,
    memory: createMockMemory(),
    repoPath: process.cwd(),
    persistRoutes: false,
  });

  return { dir, config, ctx, runtime };
}

export function cleanupTestGateway(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
