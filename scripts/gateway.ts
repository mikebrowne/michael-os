import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { requireOpenAiKey } from "../src/config/loadConfig.js";
import { ensurePrdsDir } from "../src/engineering/workItem.js";
import {
  bootstrapGatewayWorkingMemory,
  createGatewayMemorySession,
} from "../src/engineering/gatewaySession.js";
import {
  createGatewayRuntime,
  processGatewayLine,
} from "../src/gateway/session.js";
import {
  config,
  engineeringLeadAgent,
  engineeringSession,
  memory,
} from "../src/mastra/index.js";

async function main() {
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const memorySession = createGatewayMemorySession();

  await bootstrapGatewayWorkingMemory(
    memory,
    memorySession,
    engineeringSession.currentWorkItem,
  );

  const runtime = await createGatewayRuntime({
    config,
    ctx: engineeringSession,
    agent: engineeringLeadAgent,
    memory,
    memorySession,
  });

  const rl = readline.createInterface({ input, output });

  console.log("MichaelOS Engineering Gateway");
  console.log(
    "Chat with the Engineering Lead. Commands: exit | resume #N | list | jobs | job <id>",
  );
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
