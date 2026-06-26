import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const demoTool = createTool({
  id: "demo-greet",
  description: "Return a deterministic greeting for a name (no network call).",
  inputSchema: z.object({
    name: z.string().describe("Name to greet"),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async (inputData) => {
    return { message: `Hello, ${inputData.name}! Welcome to MichaelOS.` };
  },
});
