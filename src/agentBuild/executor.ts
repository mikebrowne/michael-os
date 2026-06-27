import { readFileSync } from "node:fs";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { AppConfig } from "../config/loadConfig.js";
import type { CodingExecutor, CodingExecutorResult, CodingTask } from "./types.js";

export class CursorExecutor implements CodingExecutor {
  constructor(private readonly config: AppConfig) {}

  async runTask(input: CodingTask): Promise<CodingExecutorResult> {
    const prompt = readFileSync(input.promptPath, "utf-8");
    const apiKey = this.config.cursorApiKey;
    if (!apiKey) {
      return {
        started: false,
        status: "not_started",
        summary: "CURSOR_API_KEY is not configured.",
        startupError: "Missing CURSOR_API_KEY",
      };
    }

    try {
      const result = await Agent.prompt(prompt, {
        apiKey,
        model: { id: this.config.defaultCodingModel },
        local: {
          cwd: input.worktreePath,
          settingSources: ["project"],
        },
      });

      if (result.status === "error") {
        return {
          started: true,
          status: "error",
          runId: result.id,
          summary:
            typeof result.result === "string"
              ? result.result
              : "Cursor run completed with error status.",
        };
      }

      return {
        started: true,
        status: "finished",
        runId: result.id,
        summary:
          typeof result.result === "string"
            ? result.result.slice(0, 2000)
            : "Cursor run finished.",
      };
    } catch (error: unknown) {
      if (error instanceof CursorAgentError) {
        return {
          started: false,
          status: "not_started",
          summary: `Cursor failed to start: ${error.message}`,
          startupError: error.message,
        };
      }
      throw error;
    }
  }
}

export function createCursorExecutor(config: AppConfig): CursorExecutor {
  return new CursorExecutor(config);
}
