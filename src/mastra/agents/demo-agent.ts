import { Agent } from "@mastra/core/agent";
import { demoTool } from "../tools/demo-tool.js";

export function createDemoAgent(model: string): Agent {
  return new Agent({
    id: "demo-agent",
    name: "Demo Agent",
    instructions: `You are a helpful MichaelOS demo agent.
Use the demo-greet tool when asked to greet someone by name.
Keep responses concise.`,
    model,
    tools: { demoTool },
  });
}

export const demoAgent = createDemoAgent("openai/gpt-4o-mini");
