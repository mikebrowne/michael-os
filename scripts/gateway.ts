import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { requireOpenAiKey } from "../src/config/loadConfig.js";
import { ensurePrdsDir } from "../src/engineering/workItem.js";
import { bootstrapGatewayWorkingMemory } from "../src/engineering/gatewaySession.js";
import {
  createGatewayRuntime,
  gatewayPromptLabel,
  processGatewayLine,
} from "../src/gateway/session.js";
import {
  buildGatewayAgentsMap,
  initGatewayRouteState,
} from "../src/gateway/gatewayAgents.js";
import { getThreadIdForRoute } from "../src/gateway/gatewayRouteRegistry.js";
import {
  config,
  engineeringLeadAgent,
  engagementManagerAgent,
  engineeringSession,
  memory,
  skillEngineerAgent,
} from "../src/mastra/index.js";

async function main() {
  const repoPath = process.cwd();
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const routeState = initGatewayRouteState(repoPath, false);
  const agents = buildGatewayAgentsMap({
    engineeringLeadAgent,
    skillEngineerAgent,
    engagementManagerAgent,
    repoPath,
  });

  const memorySession = {
    threadId: getThreadIdForRoute(routeState, routeState.activeAgentId),
    resourceId: routeState.resourceId,
  };

  await bootstrapGatewayWorkingMemory(
    memory,
    memorySession,
    engineeringSession.currentWorkItem,
  );

  const runtime = await createGatewayRuntime({
    config,
    ctx: engineeringSession,
    agents,
    routeState,
    memory,
    repoPath,
    persistRoutes: false,
  });

  const rl = readline.createInterface({ input, output });

  console.log("MichaelOS Engineering Gateway");
  console.log(
    "Multi-agent chat. Commands: @<agent-id> | agents | verdict | exit | resume #N | list | jobs",
  );
  console.log("Dangerous actions require YES when prompted.");
  console.log(
    `Active route: ${gatewayPromptLabel(runtime)} thread ${memorySession.threadId.slice(0, 8)}…\n`,
  );

  while (true) {
    const line = await rl.question("you> ");
    const result = await processGatewayLine(runtime, line);
    for (const part of result.output) {
      console.log(part);
    }
    if (result.exit) break;
  }

  rl.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
