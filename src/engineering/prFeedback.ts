import type { GhRunner } from "./github.js";
import { getPrChecks } from "./github.js";

export type PrFeedbackItem = {
  kind: "comment" | "ci_failure";
  author?: string;
  body: string;
};

export type PrFeedbackBundle = {
  prNumber: number;
  items: PrFeedbackItem[];
  correctiveSlicePrompt: string;
};

export async function fetchPrReviewComments(
  runner: GhRunner,
  repo: string,
  prNumber: number,
): Promise<PrFeedbackItem[]> {
  const result = await runner([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "comments",
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh pr view comments failed");
  }
  const parsed = JSON.parse(result.stdout) as {
    comments?: Array<{ author?: { login?: string }; body?: string }>;
  };
  return (parsed.comments ?? [])
    .filter((c) => (c.body ?? "").trim().length > 0)
    .map((c) => ({
      kind: "comment" as const,
      author: c.author?.login,
      body: c.body!.trim(),
    }));
}

export async function fetchPrCiFailures(
  runner: GhRunner,
  repo: string,
  prNumber: number,
): Promise<PrFeedbackItem[]> {
  const checks = await getPrChecks(runner, repo, prNumber);
  return checks
    .filter((c) => {
      const state = (c.state ?? c.conclusion ?? "").toLowerCase();
      return state.includes("fail") || state.includes("error");
    })
    .map((c) => ({
      kind: "ci_failure" as const,
      body: `CI check failed: ${c.name} (${c.state ?? c.conclusion ?? "unknown"})`,
    }));
}

export function normalizePrFeedbackToCorrectiveSlice(
  prNumber: number,
  items: PrFeedbackItem[],
): string {
  const sections = items.map((item, index) => {
    const header =
      item.kind === "comment"
        ? `### Review comment ${index + 1}${item.author ? ` (@${item.author})` : ""}`
        : `### CI failure ${index + 1}`;
    return `${header}\n${item.body}`;
  });

  return [
    `Address PR #${prNumber} feedback as a corrective bounded slice.`,
    "Fix only what the feedback requires; do not expand scope.",
    "",
    ...sections,
  ].join("\n\n");
}

export async function ingestPrFeedback(
  runner: GhRunner,
  repo: string,
  prNumber: number,
): Promise<PrFeedbackBundle> {
  const comments = await fetchPrReviewComments(runner, repo, prNumber);
  const ciFailures = await fetchPrCiFailures(runner, repo, prNumber);
  const items = [...comments, ...ciFailures];
  return {
    prNumber,
    items,
    correctiveSlicePrompt: normalizePrFeedbackToCorrectiveSlice(prNumber, items),
  };
}
