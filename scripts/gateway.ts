import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringLeadAgent } from "../src/mastra/agents/engineering-lead.js";
import { createAgentMemory } from "../src/mastra/agentMemory.js";
import { ensurePrdsDir } from "../src/engineering/workItem.js";
import {
  bootstrapGatewayWorkingMemory,
  createGatewayMemorySession,
} from "../src/engineering/gatewaySession.js";
import {
  createGatewayRuntime,
  processGatewayLine,
} from "../src/gateway/session.js";

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const ctx = createEngineeringSessionContext(config);
  const agent = createEngineeringLeadAgent(config.defaultModel, ctx);
  const memory = createAgentMemory();
  const memorySession = createGatewayMemorySession();

  await bootstrapGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);

  const runtime = await createGatewayRuntime({
    config,
    ctx,
    agent,
    memory,
    memorySession,
  });

  const rl = readline.createInterface({ input, output });

  console.log("MichaelOS Engineering Gateway");
  console.log("Chat with the Engineering Lead. Commands: exit | resume #N | list");
  console.log("Dangerous actions require YES when prompted.");
  console.log(`Session thread: ${memorySession.threadId.slice(0, 8)}… (memory on)\n`);

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
