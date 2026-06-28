import type { JobRecord } from "../engineering/jobKinds.js";

export function formatJobListLine(job: JobRecord): string {
  const issue = job.issueNumber != null ? ` #${job.issueNumber}` : "";
  return `${job.id.slice(0, 8)}  ${job.status.padEnd(9)}  ${job.kind}${issue}  → ${job.delegatedTo}`;
}

export function formatJobDetail(job: JobRecord): string {
  const lines = [
    `Job ${job.id}`,
    `  kind: ${job.kind}`,
    `  status: ${job.status}`,
    `  delegatedTo: ${job.delegatedTo}`,
    `  workItem: ${job.parentWorkItem}`,
  ];
  if (job.issueNumber != null) {
    lines.push(`  issue: #${job.issueNumber}`);
  }
  if (job.traceId) lines.push(`  traceId: ${job.traceId}`);
  if (job.mastraRunId) lines.push(`  mastraRunId: ${job.mastraRunId}`);
  if (job.mastraTaskId) lines.push(`  mastraTaskId: ${job.mastraTaskId}`);
  if (job.startedAt) lines.push(`  startedAt: ${job.startedAt}`);
  if (job.completedAt) lines.push(`  completedAt: ${job.completedAt}`);
  if (job.error) lines.push(`  error: ${job.error}`);
  lines.push(`  input: ${JSON.stringify(job.input, null, 2)}`);
  if (job.output != null) {
    lines.push(`  output: ${JSON.stringify(job.output, null, 2)}`);
  }
  return lines.join("\n");
}
