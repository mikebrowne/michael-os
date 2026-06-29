import { readFileSync } from "node:fs";
import {
  Agent,
  CursorAgentError,
  type Run,
  type SDKAgent,
  type SDKMessage,
  type SDKToolUseMessage,
} from "@cursor/sdk";
import type { AppConfig } from "../config/loadConfig.js";
import { configureCursorSdkStore } from "./cursorSdkStore.js";
import { createCursorExecutor, type CursorExecutor } from "./executor.js";
import type { SettingSource } from "@cursor/sdk";
import type {
  CodingExecutorResult,
  CodingTask,
  DurableCodingExecutor,
  DurableRunHandle,
  DurableSendRequest,
  DurableSession,
  DurableSessionResult,
  DurableSessionStart,
} from "./types.js";

export type CursorSdkBindings = {
  create: typeof Agent.create;
  resume: typeof Agent.resume;
};

const defaultBindings: CursorSdkBindings = {
  create: Agent.create.bind(Agent),
  resume: Agent.resume.bind(Agent),
};

function mapRunToHandle(agentId: string, run: Run): DurableRunHandle {
  return {
    runId: run.id,
    agentId,
    status: run.status,
    wait: async () => {
      const result = await run.wait();
      return {
        status: result.status,
        result: typeof result.result === "string" ? result.result : undefined,
        runId: result.id,
      };
    },
    cancel: () => run.cancel(),
    stream: () => run.stream(),
    supports: (operation) => run.supports(operation),
  };
}

function wrapAgent(agent: SDKAgent): DurableSession {
  return {
    agentId: agent.agentId,
    send: async (request: DurableSendRequest) => {
      const run = await agent.send(request.message, {
        mode: request.mode,
      });
      return mapRunToHandle(agent.agentId, run);
    },
    close: () => agent.close(),
  };
}

function agentOptions(config: AppConfig, worktreePath: string, mode?: "agent" | "plan") {
  return {
    apiKey: config.cursorApiKey,
    model: { id: config.defaultCodingModel },
    mode,
    local: {
      cwd: worktreePath,
      settingSources: ["project"] as SettingSource[],
    },
  };
}

export class DurableCursorExecutor implements DurableCodingExecutor {
  constructor(
    private readonly config: AppConfig,
    private readonly bindings: CursorSdkBindings = defaultBindings,
  ) {}

  async startSession(input: DurableSessionStart): Promise<DurableSessionResult> {
    const apiKey = this.config.cursorApiKey;
    if (!apiKey) {
      return { ok: false, error: "Missing CURSOR_API_KEY" };
    }

    configureCursorSdkStore(this.config.mastraDir);

    try {
      const agent = await this.bindings.create(
        agentOptions(this.config, input.worktreePath, input.initialMode),
      );
      if (input.name) {
        // name is set at create time via AgentOptions.name — re-create not needed for slice 1
      }
      return { ok: true, session: wrapAgent(agent) };
    } catch (error: unknown) {
      if (error instanceof CursorAgentError) {
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  async resumeSession(
    agentId: string,
    worktreePath: string,
  ): Promise<DurableSessionResult> {
    const apiKey = this.config.cursorApiKey;
    if (!apiKey) {
      return { ok: false, error: "Missing CURSOR_API_KEY" };
    }

    configureCursorSdkStore(this.config.mastraDir);

    try {
      const agent = await this.bindings.resume(agentId, {
        apiKey,
        local: {
          cwd: worktreePath,
          settingSources: ["project"],
        },
      });
      return { ok: true, session: wrapAgent(agent) };
    } catch (error: unknown) {
      if (error instanceof CursorAgentError) {
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  /** Run a single agent-mode send for drop-in compatibility with one-shot builds. */
  async runTask(input: CodingTask): Promise<CodingExecutorResult> {
    const prompt = readFileSync(input.promptPath, "utf-8");
    const started = await this.startSession({
      worktreePath: input.worktreePath,
      runDir: input.runDir,
      initialMode: "agent",
    });
    if (!started.ok) {
      return {
        started: false,
        status: "not_started",
        summary: started.error,
        startupError: started.error,
      };
    }

    const { session } = started;
    try {
      const run = await session.send({ message: prompt, mode: "agent" });
      const result = await run.wait();

      if (result.status === "error") {
        return {
          started: true,
          status: "error",
          runId: result.runId,
          agentId: session.agentId,
          summary: result.result ?? "Cursor run completed with error status.",
        };
      }

      if (result.status === "cancelled") {
        return {
          started: true,
          status: "cancelled",
          runId: result.runId,
          agentId: session.agentId,
          summary: result.result ?? "Cursor run was cancelled.",
        };
      }

      return {
        started: true,
        status: "finished",
        runId: result.runId,
        agentId: session.agentId,
        summary: result.result?.slice(0, 2000) ?? "Cursor run finished.",
      };
    } catch (error: unknown) {
      if (error instanceof CursorAgentError) {
        return {
          started: false,
          status: "not_started",
          summary: `Cursor failed: ${error.message}`,
          startupError: error.message,
        };
      }
      throw error;
    } finally {
      session.close();
    }
  }
}

export function createDurableCursorExecutor(config: AppConfig): DurableCursorExecutor {
  return new DurableCursorExecutor(config);
}

export type ParsedPlanCapture = {
  planMarkdown?: string;
  todos: Array<{ id: string; content: string; status: string }>;
  assistantText: string[];
};

/** Tail run.stream() for createPlan / updateTodos tool calls (used by steerableBuild). */
export async function parseStreamForPlan(
  stream: AsyncGenerator<SDKMessage>,
): Promise<ParsedPlanCapture> {
  const capture: ParsedPlanCapture = {
    todos: [],
    assistantText: [],
  };

  for await (const message of stream) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          capture.assistantText.push(block.text);
        }
      }
    }

    if (message.type === "tool_call" && message.status === "completed") {
      const toolCall = message as SDKToolUseMessage;
      if (toolCall.name === "createPlan") {
        const args = toolCall.args as { plan?: string } | undefined;
        if (typeof args?.plan === "string") {
          capture.planMarkdown = args.plan;
        }
      }
      if (toolCall.name === "updateTodos") {
        const args = toolCall.args as {
          todos?: Array<{ id: string; content: string; status: string }>;
        };
        if (Array.isArray(args?.todos)) {
          capture.todos = args.todos;
        }
      }
    }
  }

  return capture;
}

export function createCodingExecutorForMode(
  config: AppConfig,
  mode: AppConfig["codingExecutorMode"],
): DurableCursorExecutor | CursorExecutor {
  if (mode === "one-shot") {
    return createCursorExecutor(config);
  }
  return createDurableCursorExecutor(config);
}
