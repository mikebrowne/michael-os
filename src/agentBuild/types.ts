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
  status: "finished" | "error" | "not_started";
  runId?: string;
  summary: string;
  startupError?: string;
};

export interface CodingExecutor {
  runTask(input: CodingTask): Promise<CodingExecutorResult>;
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
