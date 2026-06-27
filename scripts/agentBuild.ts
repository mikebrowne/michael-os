import { loadConfig, requireOpenAiKey, requireCursorKey } from "../src/config/loadConfig.js";
import { createRunLogger } from "../src/logging/runLogger.js";
import { runAgentBuild } from "../src/agentBuild/runAgentBuild.js";
import { randomUUID } from "node:crypto";

function parseRequest(argv: string[]): string {
  const dashIndex = argv.indexOf("--");
  if (dashIndex >= 0) {
    const rest = argv.slice(dashIndex + 1).join(" ").trim();
    if (rest) return rest;
  }
  const positional = argv.find((a) => !a.startsWith("-"));
  if (positional) return positional.trim();
  throw new Error(
    'Usage: npm run agent:build -- "Your plain English build request"',
  );
}

async function main() {
  const request = parseRequest(process.argv.slice(2));
  const config = loadConfig();
  requireOpenAiKey(config);
  requireCursorKey(config);

  const runId = randomUUID();
  const runLogger = createRunLogger({
    logDir: config.logDir,
    logLevel: config.logLevel,
    name: config.appName,
  });

  const result = await runAgentBuild({
    request,
    config,
    runId,
    runLogger,
    onProgress: (message) => console.log(message),
  });

  console.log(`\nRun folder: ${result.runDir}`);
  console.log(`Result: ${result.resultPath}`);
  console.log(`Success: ${result.success}`);
  console.log(`Run logs: ${runLogger.getLogFilePath()}`);

  if (!result.success) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
