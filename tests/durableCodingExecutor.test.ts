import { describe, expect, it, vi, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config/loadConfig.js";
import {
  DurableCursorExecutor,
  parseStreamForPlan,
  createCodingExecutorForMode,
} from "../src/agentBuild/durableCodingExecutor.js";
import { resetCursorSdkStoreForTests } from "../src/agentBuild/cursorSdkStore.js";
import type { Run, SDKAgent } from "@cursor/sdk";

function createMockRun(overrides: Partial<Run> = {}): Run {
  const messages = [
    {
      type: "tool_call" as const,
      agent_id: "agent-1",
      run_id: "run-1",
      call_id: "c1",
      name: "createPlan",
      status: "completed" as const,
      args: { plan: "## Plan\n- [ ] Slice A" },
    },
    {
      type: "tool_call" as const,
      agent_id: "agent-1",
      run_id: "run-1",
      call_id: "c2",
      name: "updateTodos",
      status: "completed" as const,
      args: {
        todos: [{ id: "1", content: "Slice A", status: "pending" }],
      },
    },
  ];

  return {
    id: "run-1",
    agentId: "agent-1",
    status: "finished",
    supports: () => true,
    unsupportedReason: () => undefined,
    async *stream() {
      for (const message of messages) {
        yield message;
      }
    },
    conversation: async () => [],
    wait: async () => ({
      id: "run-1",
      status: "finished" as const,
      result: "done",
    }),
    cancel: async () => {},
    onDidChangeStatus: () => () => {},
    ...overrides,
  };
}

function createMockAgent(run: Run): SDKAgent {
  return {
    agentId: "agent-1",
    model: { id: "composer-2.5" },
    send: vi.fn(async () => run),
    close: vi.fn(),
    reload: vi.fn(async () => {}),
    [Symbol.asyncDispose]: vi.fn(async () => {}),
    listArtifacts: vi.fn(async () => []),
    downloadArtifact: vi.fn(async () => Buffer.from("")),
  };
}

describe("durableCodingExecutor", () => {
  beforeEach(() => {
    resetCursorSdkStoreForTests();
  });

  it("defaults codingExecutorMode to durable", () => {
    const config = loadConfig();
    expect(config.codingExecutorMode).toBe("durable");
  });

  it("creates one-shot executor when mode is one-shot", () => {
    const config = { ...loadConfig(), codingExecutorMode: "one-shot" as const };
    const executor = createCodingExecutorForMode(config, "one-shot");
    expect(executor.constructor.name).toBe("CursorExecutor");
  });

  it("creates durable executor when mode is durable", () => {
    const config = loadConfig();
    const executor = createCodingExecutorForMode(config, "durable");
    expect(executor).toBeInstanceOf(DurableCursorExecutor);
  });

  it("startSession + send + wait returns finished result", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-durable-"));
    const config = {
      ...loadConfig(),
      mastraDir: join(dir, ".mastra"),
      cursorApiKey: "test-key",
      codingExecutorMode: "durable" as const,
    };
    const run = createMockRun();
    const agent = createMockAgent(run);

    const executor = new DurableCursorExecutor(config, {
      create: vi.fn(async () => agent),
      resume: vi.fn(async () => agent),
    });

    const started = await executor.startSession({
      worktreePath: dir,
      runDir: join(dir, "run"),
      initialMode: "agent",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const handle = await started.session.send({
      message: "implement",
      mode: "agent",
    });
    const result = await handle.wait();
    expect(result.status).toBe("finished");
    expect(agent.send).toHaveBeenCalled();
    started.session.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("runTask reads prompt and maps to CodingExecutorResult", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-durable-task-"));
    const promptPath = join(dir, "task.md");
    writeFileSync(promptPath, "Build the feature.\n", "utf-8");
    const config = {
      ...loadConfig(),
      mastraDir: join(dir, ".mastra"),
      cursorApiKey: "test-key",
      codingExecutorMode: "durable" as const,
    };
    const run = createMockRun();
    const agent = createMockAgent(run);

    const executor = new DurableCursorExecutor(config, {
      create: vi.fn(async () => agent),
      resume: vi.fn(async () => agent),
    });

    const result = await executor.runTask({
      repoPath: dir,
      worktreePath: dir,
      runDir: join(dir, "run"),
      specPath: join(dir, "spec.md"),
      promptPath,
      acceptanceTestPath: join(dir, "test.ts"),
    });

    expect(result.started).toBe(true);
    expect(result.status).toBe("finished");
    expect(result.agentId).toBe("agent-1");
    rmSync(dir, { recursive: true, force: true });
  });

  it("parseStreamForPlan captures createPlan and updateTodos", async () => {
    const run = createMockRun();
    const capture = await parseStreamForPlan(run.stream());
    expect(capture.planMarkdown).toContain("## Plan");
    expect(capture.todos).toHaveLength(1);
    expect(capture.todos[0]?.content).toBe("Slice A");
  });

  it("resumeSession wraps resumed agent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-resume-"));
    const config = {
      ...loadConfig(),
      mastraDir: join(dir, ".mastra"),
      cursorApiKey: "test-key",
    };
    const agent = createMockAgent(createMockRun());

    const executor = new DurableCursorExecutor(config, {
      create: vi.fn(async () => agent),
      resume: vi.fn(async () => agent),
    });

    const resumed = await executor.resumeSession("agent-1", dir);
    expect(resumed.ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
