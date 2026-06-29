import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { requireOpenAiKey } from "../src/config/loadConfig.js";
import {
  createGatewayMemorySession,
  gatewayMemoryOptions,
} from "../src/engineering/gatewaySession.js";
import { parseYesNo, grantPendingApproval } from "../src/engineering/approvalGate.js";
import { createSkillEngineerSessionContext } from "../src/skills/skillEngineerSession.js";
import { createSkillEngineerAgent } from "../src/mastra/agents/skill-engineer.js";
import { loadConfig } from "../src/config/loadConfig.js";

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);

  const ctx = createSkillEngineerSessionContext(config);
  const agent = createSkillEngineerAgent(config.defaultModel, ctx, ctx.repoPath);
  const memorySession = createGatewayMemorySession();

  const rl = readline.createInterface({ input, output });

  console.log("MichaelOS Skill Engineer Gateway");
  console.log("Chat with the Skill Engineer. Commands: exit");
  console.log("Dangerous skill declarations require YES when prompted.\n");

  while (true) {
    const line = await rl.question("you> ");
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
      console.log("Skill gateway closed.");
      break;
    }

    const yesNo = parseYesNo(trimmed);
    if (yesNo && ctx.approval.pending) {
      if (yesNo === "yes") {
        grantPendingApproval(ctx.approval);
        console.log("agent> Approval granted. Re-run the skill action.");
      } else {
        ctx.approval.pending = undefined;
        console.log("agent> Approval denied.");
      }
      continue;
    }

    const response = await agent.generate(
      trimmed,
      gatewayMemoryOptions(memorySession),
    );
    console.log(`agent> ${response.text ?? "(no response)"}`);
  }

  rl.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
