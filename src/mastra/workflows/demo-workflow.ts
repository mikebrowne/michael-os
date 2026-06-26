import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { RunLogger } from "../../logging/runLogger.js";

const noteSummarySchema = z.object({
  noteTitle: z.string(),
  wordCount: z.number(),
  preview: z.string(),
  vaultPath: z.string(),
});

export function listMarkdownNotes(vaultPath: string): string[] {
  return readdirSync(vaultPath)
    .filter((name) => name.endsWith(".md"))
    .sort();
}

export function summarizeNote(vaultPath: string, noteFileName: string) {
  const content = readFileSync(join(vaultPath, noteFileName), "utf-8");
  const title =
    content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? noteFileName.replace(/\.md$/, "");
  const words = content.split(/\s+/).filter(Boolean);
  const preview = content.slice(0, 120).replace(/\s+/g, " ").trim();

  return {
    noteTitle: title,
    wordCount: words.length,
    preview,
    vaultPath,
  };
}

const readDemoNote = createStep({
  id: "read-demo-note",
  description: "Read and summarize the first markdown note in the Demo vault",
  inputSchema: z.object({
    vaultPath: z.string(),
    runId: z.string(),
  }),
  outputSchema: noteSummarySchema,
  execute: async ({ inputData }) => {
    const notes = listMarkdownNotes(inputData.vaultPath);
    if (notes.length === 0) {
      throw new Error(`No markdown notes found in Demo vault: ${inputData.vaultPath}`);
    }
    return summarizeNote(inputData.vaultPath, notes[0]!);
  },
});

export const demoWorkflow = createWorkflow({
  id: "demo-vault-summary",
  inputSchema: z.object({
    vaultPath: z.string(),
    runId: z.string(),
  }),
  outputSchema: noteSummarySchema,
})
  .then(readDemoNote);

demoWorkflow.commit();

export async function runDemoWorkflow(
  vaultPath: string,
  runId: string,
  runLogger?: RunLogger,
) {
  runLogger?.log({
    runId,
    event: "workflow.start",
    data: { workflowId: "demo-vault-summary", vaultPath },
  });

  const run = await demoWorkflow.createRun({ runId });
  const result = await run.start({
    inputData: { vaultPath, runId },
  });

  if (result.status !== "success") {
    runLogger?.log({
      runId,
      event: "workflow.error",
      data: { status: result.status },
    });
    throw new Error(`Demo workflow failed with status: ${result.status}`);
  }

  runLogger?.log({
    runId,
    event: "workflow.complete",
    data: { result: result.result },
  });

  return result.result;
}
