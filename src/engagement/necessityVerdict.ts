import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RunLogger } from "../logging/runLogger.js";

export type NecessityDecision = "build" | "reuse" | "adapt";

export type NecessitySourceKind = "registry" | "comprehension" | "framework-first";

export type NecessitySource = {
  kind: NecessitySourceKind;
  summary: string;
  refs?: string[];
};

export type NecessityVerdict = {
  decision: NecessityDecision;
  rationale: string;
  sources: NecessitySource[];
  timestamp: string;
  routedTo?: string;
  workItemSlug: string;
};

export function necessityVerdictPath(
  stateDir: string,
  workItemSlug: string,
): string {
  return join(stateDir, workItemSlug, "necessity-verdict.md");
}

export function formatNecessityVerdictMarkdown(verdict: NecessityVerdict): string {
  const frontmatter = [
    "---",
    `decision: ${verdict.decision}`,
    `timestamp: ${verdict.timestamp}`,
    `workItemSlug: ${verdict.workItemSlug}`,
    verdict.routedTo ? `routedTo: ${verdict.routedTo}` : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const sourceLines = verdict.sources.map((s) => {
    const refs = s.refs?.length ? ` (${s.refs.join(", ")})` : "";
    return `- **${s.kind}**: ${s.summary}${refs}`;
  });

  return `${frontmatter}

# Necessity verdict

**Decision:** ${verdict.decision}

## Rationale

${verdict.rationale}

## Sources

${sourceLines.join("\n")}
`;
}

export function writeNecessityVerdict(
  stateDir: string,
  verdict: NecessityVerdict,
): string {
  const path = necessityVerdictPath(stateDir, verdict.workItemSlug);
  mkdirSync(join(stateDir, verdict.workItemSlug), { recursive: true });
  writeFileSync(path, formatNecessityVerdictMarkdown(verdict), "utf-8");
  return path;
}

export function readNecessityVerdict(
  stateDir: string,
  workItemSlug: string,
): NecessityVerdict | undefined {
  const path = necessityVerdictPath(stateDir, workItemSlug);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf-8");
  const decisionMatch = raw.match(/^decision:\s*(build|reuse|adapt)/m);
  const timestampMatch = raw.match(/^timestamp:\s*(.+)$/m);
  const routedMatch = raw.match(/^routedTo:\s*(.+)$/m);
  const rationaleMatch = raw.match(/## Rationale\s*\n\s*\n([\s\S]*?)\n\n## Sources/m);

  if (!decisionMatch?.[1] || !timestampMatch?.[1]) return undefined;

  const sources: NecessitySource[] = [];
  const sourceSection = raw.split("## Sources")[1] ?? "";
  for (const line of sourceSection.split("\n")) {
    const m = line.match(/^- \*\*(registry|comprehension|framework-first)\*\*:\s*(.+)$/);
    if (m) {
      sources.push({ kind: m[1] as NecessitySourceKind, summary: m[2]!.trim() });
    }
  }

  return {
    decision: decisionMatch[1] as NecessityDecision,
    rationale: rationaleMatch?.[1]?.trim() ?? "",
    sources,
    timestamp: timestampMatch[1]!.trim(),
    routedTo: routedMatch?.[1]?.trim(),
    workItemSlug,
  };
}

export function formatNecessityVerdictSummary(
  verdict: NecessityVerdict,
): string {
  const lines = [
    `Necessity verdict for "${verdict.workItemSlug}": ${verdict.decision}`,
    verdict.rationale,
    `Recorded: ${verdict.timestamp}`,
  ];
  if (verdict.routedTo) {
    lines.push(`Routed to: ${verdict.routedTo}`);
  }
  if (verdict.sources.length > 0) {
    lines.push("Sources:");
    for (const s of verdict.sources) {
      lines.push(`  - [${s.kind}] ${s.summary}`);
    }
  }
  return lines.join("\n");
}

export function logNecessityVerdictEvent(
  runLogger: RunLogger,
  verdict: NecessityVerdict,
  sessionId?: string,
): void {
  runLogger.log({
    runId: sessionId ?? verdict.workItemSlug,
    event: "necessity.verdict",
    data: {
      decision: verdict.decision,
      workItemSlug: verdict.workItemSlug,
      routedTo: verdict.routedTo,
      sourceCount: verdict.sources.length,
      timestamp: verdict.timestamp,
    },
  });
}
