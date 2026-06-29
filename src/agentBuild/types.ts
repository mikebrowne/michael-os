import type { SDKMessage } from "@cursor/sdk";

export type CodingExecutorMode = "durable" | "one-shot";

export type AgentConversationMode = "agent" | "plan";

export type CodingTask = {
  repoPath: string;
  worktreePath: string;
  runDir: string;
  specPath: string;
  promptPath: string;
  acceptanceTestPath: string;
};

export type CodingExecutorResult = {
  started: boolean;
  status: "finished" | "error" | "not_started" | "cancelled";
  runId?: string;
  agentId?: string;
  summary: string;
  startupError?: string;
};

export interface CodingExecutor {
  runTask(input: CodingTask): Promise<CodingExecutorResult>;
}

export type DurableSessionStart = {
  worktreePath: string;
  runDir: string;
  name?: string;
  initialMode?: AgentConversationMode;
};

export type DurableSendRequest = {
  message: string;
  mode?: AgentConversationMode;
};

export type DurableRunStatus = "running" | "finished" | "error" | "cancelled";

export type DurableRunHandle = {
  runId: string;
  agentId: string;
  status: DurableRunStatus;
  wait(): Promise<{
    status: Exclude<DurableRunStatus, "running">;
    result?: string;
    runId: string;
  }>;
  cancel(): Promise<void>;
  stream(): AsyncGenerator<SDKMessage>;
  supports(operation: "stream" | "wait" | "cancel" | "conversation"): boolean;
};

export type DurableSession = {
  agentId: string;
  send(request: DurableSendRequest): Promise<DurableRunHandle>;
  close(): void;
};

export type DurableSessionError = {
  ok: false;
  error: string;
};

export type DurableSessionResult =
  | { ok: true; session: DurableSession }
  | DurableSessionError;

export interface DurableCodingExecutor {
  startSession(input: DurableSessionStart): Promise<DurableSessionResult>;
  resumeSession(
    agentId: string,
    worktreePath: string,
  ): Promise<DurableSessionResult>;
}

export type GateResult = {
  passed: boolean;
  exitCode: number | null;
  log: string;
  hash?: string;
};

export type PreflightStepResult = {
  script: string;
  ran: boolean;
  passed: boolean;
  skipped: boolean;
  output: string;
};

export type PreflightResult = {
  passed: boolean;
  steps: PreflightStepResult[];
  log: string;
};

export type AgentBuildResult = {
  runDir: string;
  success: boolean;
  resultPath: string;
};
