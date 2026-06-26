import { randomUUID } from "node:crypto";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createRunLogger } from "../src/logging/runLogger.js";
import { createDemoAgent } from "../src/mastra/agents/demo-agent.js";
import { runDemoWorkflow } from "../src/mastra/workflows/demo-workflow.js";

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);

  const runId = randomUUID();
  const runLogger = createRunLogger({
    logDir: config.logDir,
    logLevel: config.logLevel,
    name: config.appName,
  });

  console.log("Running deterministic Demo vault workflow...");
  const summary = await runDemoWorkflow(config.vaultPath, runId, runLogger);
  console.log("Workflow result:", summary);

  console.log("\nRunning live OpenAI demo agent call...");
  const agent = createDemoAgent(config.defaultModel);
  const response = await agent.generate(
    "Use the demo-greet tool to greet the operator named Michael.",
  );

  runLogger.log({
    runId,
    event: "demo.agent.complete",
    data: { textLength: response.text?.length ?? 0 },
  });

  console.log("\nAgent response:");
  console.log(response.text);
  console.log(`\nRun logs written to: ${runLogger.getLogFilePath()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
