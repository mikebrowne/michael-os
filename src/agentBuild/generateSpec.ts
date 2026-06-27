import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { createSpecAgent } from "../mastra/agents/spec-agent.js";
import type { RunDirectory } from "./runDir.js";

const specOutputSchema = z.object({
  specMd: z.string().min(1),
  cursorTaskMd: z.string().min(1),
  acceptanceTestRelativePath: z.string().min(1),
  acceptanceTestContent: z.string().min(1),
});

export type SpecArtifacts = z.infer<typeof specOutputSchema> & {
  acceptanceTestPath: string;
};

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  throw new Error("Spec agent response did not contain parseable JSON.");
}

export async function generateSpecArtifacts(
  request: string,
  model: string,
  paths: RunDirectory,
): Promise<SpecArtifacts> {
  const agent = createSpecAgent(model);
  const response = await agent.generate(
    `Build request:\n${request}\n\nProduce the JSON spec artifacts.`,
  );

  const rawText = response.text ?? "";
  const parsed = specOutputSchema.parse(
    JSON.parse(extractJson(rawText)) as unknown,
  );

  writeFileSync(paths.specPath, `${parsed.specMd.trim()}\n`, "utf-8");
  writeFileSync(paths.cursorTaskPath, `${parsed.cursorTaskMd.trim()}\n`, "utf-8");
  writeFileSync(
    paths.acceptanceTestPath,
    `${parsed.acceptanceTestContent.trim()}\n`,
    "utf-8",
  );

  return {
    ...parsed,
    acceptanceTestPath: paths.acceptanceTestPath,
  };
}

export function installAcceptanceTestInWorktree(
  worktreePath: string,
  acceptanceTestRelativePath: string,
  acceptanceTestContent: string,
): string {
  const dest = join(worktreePath, acceptanceTestRelativePath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `${acceptanceTestContent.trim()}\n`, "utf-8");
  return dest;
}
