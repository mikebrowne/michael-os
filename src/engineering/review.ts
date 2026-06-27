import { z } from "zod";
import type { Agent } from "@mastra/core/agent";

export const reviewFindingSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]),
  file: z.string(),
  line: z.string().optional(),
  message: z.string(),
});

export const reviewVerdictSchema = z.object({
  decision: z.enum(["approve", "request-changes", "block"]),
  rationale: z.string(),
  findings: z.array(reviewFindingSchema),
});

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewVerdict = z.infer<typeof reviewVerdictSchema>;

export type CodeReviewInput = {
  gitDiff: string;
  prdMarkdown: string;
  acceptanceTest: string;
  changedFiles: string[];
};

function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

export function parseReviewVerdict(raw: string): ReviewVerdict {
  const jsonText = extractJsonFromText(raw);
  const parsed = JSON.parse(jsonText) as unknown;
  return reviewVerdictSchema.parse(parsed);
}

export function formatReviewVerdictReport(verdict: ReviewVerdict): string {
  const lines = [
    `Review verdict: **${verdict.decision.toUpperCase()}**`,
    `Rationale: ${verdict.rationale}`,
  ];
  if (verdict.findings.length > 0) {
    lines.push("", "Findings:");
    for (const f of verdict.findings) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`- [${f.severity}] ${loc}: ${f.message}`);
    }
  } else {
    lines.push("", "No specific findings.");
  }
  lines.push(
    "",
    "Note: review is advisory — operator YES still required to ship.",
  );
  return lines.join("\n");
}

export async function runCodeReview(
  agent: Agent,
  input: CodeReviewInput,
): Promise<ReviewVerdict> {
  const prompt = `Review this green build.

## Changed files
${input.changedFiles.join(", ") || "(none)"}

## PRD
${input.prdMarkdown}

## Acceptance test
\`\`\`typescript
${input.acceptanceTest}
\`\`\`

## Git diff
\`\`\`diff
${input.gitDiff.slice(0, 12000)}
\`\`\`

Return ONLY the JSON verdict object.`;

  const response = await agent.generate(prompt);
  const text = response.text ?? "";
  return parseReviewVerdict(text);
}
