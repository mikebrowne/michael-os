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

export function normalizeAcceptanceImports(content: string): string {
  return content
    .replace(/from (['"])\.\.\/src\//g, "from $1../../src/")
    .replace(/import\((['"])\.\.\/src\//g, "import($1../../src/");
}

function validateAcceptanceTestImports(content: string): void {
  if (/from (['"])\.\.\/src\//.test(content) || /import\((['"])\.\.\/src\//.test(content)) {
    throw new Error(
      "Acceptance test imports must use ../../src/ (file lives at tests/acceptance/).",
    );
  }
}

function parseSpecAgentJson(rawText: string): z.infer<typeof specOutputSchema> {
  const parsed = specOutputSchema.parse(
    JSON.parse(extractJson(rawText)) as unknown,
  );
  parsed.acceptanceTestContent = normalizeAcceptanceImports(
    parsed.acceptanceTestContent,
  );
  validateAcceptanceTestImports(parsed.acceptanceTestContent);
  return parsed;
}

const SPEC_GENERATION_ATTEMPTS = 3;

export async function generateSpecArtifacts(
  request: string,
  model: string,
  paths: RunDirectory,
): Promise<SpecArtifacts> {
  const agent = createSpecAgent(model);
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= SPEC_GENERATION_ATTEMPTS; attempt++) {
    try {
      const response = await agent.generate(
        `Build request:\n${request}\n\nProduce the JSON spec artifacts.`,
      );

      const rawText = response.text ?? "";
      writeFileSync(
        join(paths.runDir, `spec-agent-raw-${attempt}.txt`),
        rawText,
        "utf-8",
      );
      const parsed = parseSpecAgentJson(rawText);

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
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === SPEC_GENERATION_ATTEMPTS) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Spec generation failed.");
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
