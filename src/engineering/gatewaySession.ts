import { randomUUID } from "node:crypto";
import type { Memory } from "@mastra/memory";
import type { WorkItem } from "./workItem.js";

export const GATEWAY_RESOURCE_ID = "operator";

export type GatewayMemorySession = {
  threadId: string;
  resourceId: string;
};

export function createGatewayMemorySession(): GatewayMemorySession {
  return {
    threadId: randomUUID(),
    resourceId: GATEWAY_RESOURCE_ID,
  };
}

export type GatewayGenerateOptions = {
  memory: {
    thread: string;
    resource: string;
  };
};

export function gatewayMemoryOptions(
  session: GatewayMemorySession,
): GatewayGenerateOptions {
  return {
    memory: {
      thread: session.threadId,
      resource: session.resourceId,
    },
  };
}

function formatWorkItemBlock(item: WorkItem | null | undefined): string {
  if (!item) {
    return "Current work item: none selected yet.";
  }

  const lines = [
    `Current work item:`,
    `- slug: ${item.slug}`,
    `- title: ${item.title}`,
    `- stage: ${item.stage}`,
  ];
  if (item.issueNumber) lines.push(`- GitHub issue: #${item.issueNumber}`);
  if (item.prdPath) lines.push(`- PRD: ${item.prdPath}`);
  if (item.grillNotesPath) lines.push(`- grill notes: ${item.grillNotesPath}`);
  if (item.acceptanceTestPath) {
    lines.push(`- acceptance test: ${item.acceptanceTestPath}`);
  }
  if (item.lastRunDir) lines.push(`- last build run: ${item.lastRunDir}`);
  if (item.lastBuildSuccess !== undefined) {
    lines.push(`- last build success: ${item.lastBuildSuccess}`);
  }
  if (item.manifestPath) lines.push(`- build manifest: ${item.manifestPath}`);
  if (item.lastBuildSuccess && item.manifestPath) {
    lines.push(`- green build may be shippable after resume (manifest rehydrate)`);
  }
  return lines.join("\n");
}

function buildWorkingMemoryContent(workItem?: WorkItem | null): string {
  return `# MichaelOS Engineering Gateway Session

## Role
You are the Engineering Lead — not a generic assistant. Stay in character.

## Pipeline
grill → PRD (+ GitHub issue) → tests → build → review (advisory) → report → ship-docs / ship-implementation

## Rules
- Use tools for ALL side effects (saving files, issues, builds, ship).
- Dangerous tools (run-build, ship-docs, ship-implementation) return needsApproval — tell the operator to reply YES or NO.
- Never invent build pass/fail — only report tool results.
- "Ship" means git commit/push via ship-docs or ship-implementation — NOT logistics/shipment.
- If operator asks you to draft a commit message, draft it and call the ship tool — do not re-interview.
- PRDs live in docs/prds/. Work-item manifest is in .mastra/state/ (gitignored).

${formatWorkItemBlock(workItem)}
`;
}

async function ensureGatewayThread(
  memory: Memory,
  session: GatewayMemorySession,
  workingMemory: string,
): Promise<void> {
  const existing = await memory.getThreadById({
    threadId: session.threadId,
    resourceId: session.resourceId,
  });
  if (existing) {
    return;
  }

  const now = new Date();
  await memory.saveThread({
    thread: {
      id: session.threadId,
      resourceId: session.resourceId,
      title: "Engineering Gateway",
      createdAt: now,
      updatedAt: now,
      metadata: { workingMemory },
    },
  });
}

export async function bootstrapGatewayWorkingMemory(
  memory: Memory,
  session: GatewayMemorySession,
  workItem?: WorkItem | null,
): Promise<void> {
  const workingMemory = buildWorkingMemoryContent(workItem);
  await ensureGatewayThread(memory, session, workingMemory);
  await memory.updateWorkingMemory({
    threadId: session.threadId,
    resourceId: session.resourceId,
    workingMemory,
  });
}

export async function refreshGatewayWorkingMemory(
  memory: Memory,
  session: GatewayMemorySession,
  workItem?: WorkItem | null,
): Promise<void> {
  await bootstrapGatewayWorkingMemory(memory, session, workItem);
}
