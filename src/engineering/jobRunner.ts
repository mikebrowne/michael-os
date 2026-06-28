import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { BackgroundTaskManager } from "@mastra/core/background-tasks";
import { createBackgroundTask } from "@mastra/core/background-tasks";
import type { JobRegistry } from "./jobRegistry.js";
import type { CodeReviewJobInput } from "./jobKinds.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";
import type { ReviewVerdict } from "./review.js";

export type JobCompletionEvent = {
  jobId: string;
  kind: string;
  status: "succeeded" | "failed";
  headline: string;
  parentWorkItem: string;
  issueNumber?: number;
};

export const jobNotificationBus = new EventEmitter();

export type JobRunnerDeps = {
  jobRegistry: JobRegistry;
  observability: ObservabilityStore;
  backgroundTaskManager?: BackgroundTaskManager;
};

export type RunCodeReviewJobOptions = {
  parentWorkItem: string;
  issueNumber?: number;
  delegatedTo?: string;
  input: CodeReviewJobInput;
  traceId?: string;
  executeReview: () => Promise<ReviewVerdict>;
};

function formatJobHeadline(
  jobId: string,
  status: "succeeded" | "failed",
  kind: string,
  issueNumber?: number,
  detail?: string,
): string {
  const icon = status === "succeeded" ? "✓" : "✗";
  const issue = issueNumber != null ? ` #${issueNumber}` : "";
  const suffix = detail ? ` → ${detail}` : "";
  return `[job ${jobId.slice(0, 8)} ${icon}] ${kind}${issue}${suffix}`;
}

export class JobRunner {
  constructor(private readonly deps: JobRunnerDeps) {}

  setBackgroundTaskManager(manager: BackgroundTaskManager | undefined): void {
    this.deps.backgroundTaskManager = manager;
  }

  private emitLifecycle(
    event: string,
    correlation: {
      jobId: string;
      workItemSlug?: string;
      issueNumber?: number;
      traceId?: string;
      mastraRunId?: string;
      agentId?: string;
    },
    data?: Record<string, unknown>,
  ): void {
    this.deps.observability.emit(event, correlation, data, "minimal");
  }

  private notifyCompletion(payload: JobCompletionEvent): void {
    jobNotificationBus.emit("job.completed", payload);
  }

  async runCodeReviewJob(options: RunCodeReviewJobOptions): Promise<{
    jobId: string;
    verdict: ReviewVerdict;
  }> {
    const traceId = options.traceId ?? randomUUID();
    const runId = randomUUID();
    const delegatedTo = options.delegatedTo ?? "code-reviewer";

    const job = await this.deps.jobRegistry.createJob({
      kind: "code-review",
      parentWorkItem: options.parentWorkItem,
      issueNumber: options.issueNumber,
      delegatedTo,
      input: options.input as unknown as Record<string, unknown>,
      traceId,
      mastraRunId: runId,
    });

    this.emitLifecycle("job.created", {
      jobId: job.id,
      workItemSlug: options.parentWorkItem,
      issueNumber: options.issueNumber,
      traceId,
      mastraRunId: runId,
      agentId: delegatedTo,
    });

    const execute = async (): Promise<ReviewVerdict> => {
      await this.deps.jobRegistry.updateJob(job.id, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
      this.emitLifecycle("job.started", {
        jobId: job.id,
        workItemSlug: options.parentWorkItem,
        issueNumber: options.issueNumber,
        traceId,
        agentId: delegatedTo,
      });

      try {
        const verdict = await options.executeReview();
        const completedAt = new Date().toISOString();
        await this.deps.jobRegistry.updateJob(job.id, {
          status: "succeeded",
          output: verdict,
          completedAt,
        });
        this.emitLifecycle(
          "job.completed",
          {
            jobId: job.id,
            workItemSlug: options.parentWorkItem,
            issueNumber: options.issueNumber,
            traceId,
            agentId: delegatedTo,
          },
          {
            decision: verdict.decision,
            findingCount: verdict.findings.length,
            durationMs:
              completedAt && job.createdAt
                ? Date.parse(completedAt) - Date.parse(job.createdAt)
                : undefined,
          },
        );
        this.notifyCompletion({
          jobId: job.id,
          kind: "code-review",
          status: "succeeded",
          headline: formatJobHeadline(
            job.id,
            "succeeded",
            "code-review",
            options.issueNumber,
            verdict.decision,
          ),
          parentWorkItem: options.parentWorkItem,
          issueNumber: options.issueNumber,
        });
        return verdict;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await this.deps.jobRegistry.updateJob(job.id, {
          status: "failed",
          error: message,
          completedAt: new Date().toISOString(),
        });
        this.emitLifecycle(
          "job.failed",
          {
            jobId: job.id,
            workItemSlug: options.parentWorkItem,
            issueNumber: options.issueNumber,
            traceId,
            agentId: delegatedTo,
          },
          { error: message },
        );
        this.notifyCompletion({
          jobId: job.id,
          kind: "code-review",
          status: "failed",
          headline: formatJobHeadline(
            job.id,
            "failed",
            "code-review",
            options.issueNumber,
            message,
          ),
          parentWorkItem: options.parentWorkItem,
          issueNumber: options.issueNumber,
        });
        throw error;
      }
    };

    const manager = this.deps.backgroundTaskManager;
    if (manager?.config.enabled) {
      const toolCallId = randomUUID();
      const bgTask = createBackgroundTask(manager, {
        toolName: "code-review",
        toolCallId,
        args: { jobId: job.id },
        agentId: "engineering-lead",
        runId,
        context: {
          executor: {
            execute: async () => execute(),
          },
        },
      });
      await this.deps.jobRegistry.updateJob(job.id, {
        mastraTaskId: toolCallId,
      });
      this.emitLifecycle("job.delegated", {
        jobId: job.id,
        workItemSlug: options.parentWorkItem,
        issueNumber: options.issueNumber,
        traceId,
        mastraRunId: runId,
        agentId: delegatedTo,
      });
      const dispatch = await bgTask.dispatch();
      if (dispatch.fallbackToSync) {
        const verdict = await execute();
        return { jobId: job.id, verdict };
      }
      await bgTask.waitForCompletion();
      const updated = await this.deps.jobRegistry.getJob(job.id);
      if (!updated?.output) {
        throw new Error(`Code review job ${job.id} completed without output`);
      }
      return {
        jobId: job.id,
        verdict: updated.output as ReviewVerdict,
      };
    }

    this.emitLifecycle("job.delegated", {
      jobId: job.id,
      workItemSlug: options.parentWorkItem,
      issueNumber: options.issueNumber,
      traceId,
      agentId: delegatedTo,
    });
    const verdict = await execute();
    return { jobId: job.id, verdict };
  }
}

export function createJobRunner(deps: JobRunnerDeps): JobRunner {
  return new JobRunner(deps);
}
