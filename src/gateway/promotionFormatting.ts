import type { PromotionRecord } from "../engineering/promotionRegistry.js";

export function formatPromotionListLine(record: PromotionRecord): string {
  const issue =
    record.issueNumber != null ? ` issue #${record.issueNumber}` : "";
  const status = record.status === "rolled-back" ? " (rolled back)" : "";
  return `#${record.promotionNumber}  ${record.commitSha.slice(0, 8)}  ${record.parentWorkItem}${issue}  PR #${record.prNumber}${status}`;
}

export function formatPromotionDetail(record: PromotionRecord): string {
  const lines = [
    `Promotion #${record.promotionNumber}`,
    `  status: ${record.status}`,
    `  commit: ${record.commitSha}`,
    `  workItem: ${record.parentWorkItem}`,
    `  pr: #${record.prNumber}`,
    `  branch: ${record.branchName}`,
  ];
  if (record.issueNumber != null) {
    lines.push(`  issue: #${record.issueNumber}`);
  }
  if (record.revertCommitSha) {
    lines.push(`  revertCommit: ${record.revertCommitSha}`);
  }
  if (record.gatesPassed.length > 0) {
    lines.push(`  gatesPassed: ${record.gatesPassed.join(", ")}`);
  }
  if (record.gatesOverridden.length > 0) {
    lines.push(
      `  gatesOverridden: ${record.gatesOverridden
        .map((g) => `${g.kind}=${g.overridden}`)
        .join(", ")}`,
    );
  }
  lines.push(`  createdAt: ${record.createdAt}`);
  return lines.join("\n");
}
