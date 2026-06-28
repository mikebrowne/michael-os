import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import { loadConfig } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createGatewayMemorySession } from "../src/engineering/gatewaySession.js";
import {
  createGatewayRuntime,
  processGatewayLine,
} from "../src/gateway/session.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";

function createMockAgent(): Agent {
  return {
    id: "engineering-lead",
    generate: async () => ({ text: "mock response" }),
  } as unknown as Agent;
}

function createMockMemory(): Memory {
  return {
    getThreadById: async () => null,
    saveThread: async () => {},
    saveMessages: async () => {},
    updateWorkingMemory: async () => {},
  } as unknown as Memory;
}

describe("gateway session commands", () => {
  async function createRuntime() {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-gw-"));
    const config = {
      ...loadConfig(),
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };
    const observability = createObservabilityStore({
      logDir: config.logDir,
      mastraDir: config.mastraDir,
      config: createObservabilityConfig({ level: "minimal" }),
    });
    const jobRegistry = createJobRegistry(config.mastraDir);
    const jobRunner = createJobRunner({ jobRegistry, observability });
    const ctx = createEngineeringSessionContext(config, {
      observability,
      jobRegistry,
      jobRunner,
      repoPath: process.cwd(),
      qaEngineerAgent: createMockAgent(),
    });
    const runtime = await createGatewayRuntime({
      config,
      ctx,
      agent: createMockAgent(),
      memory: createMockMemory(),
      memorySession: createGatewayMemorySession(),
    });
    return { dir, jobRegistry, runtime };
  }

  it("jobs lists recent job records", async () => {
    const { dir, jobRegistry, runtime } = await createRuntime();
    try {
      await jobRegistry.createJob({
        kind: "code-review",
        parentWorkItem: "feat-a",
        issueNumber: 1,
        delegatedTo: "qa-engineer",
        input: { workItemSlug: "feat-a" },
      });

      const result = await processGatewayLine(runtime, "jobs");
      const text = result.output.join("");
      expect(text).toContain("Recent jobs:");
      expect(text).toContain("code-review");
      expect(text).toContain("#1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("jobs reports empty when no records exist", async () => {
    const { dir, runtime } = await createRuntime();
    try {
      const result = await processGatewayLine(runtime, "jobs");
      expect(result.output.join("")).toContain("No jobs found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("job <id> shows job detail by prefix", async () => {
    const { dir, jobRegistry, runtime } = await createRuntime();
    try {
      const job = await jobRegistry.createJob({
        kind: "code-review",
        parentWorkItem: "feat-b",
        delegatedTo: "qa-engineer",
        input: { workItemSlug: "feat-b" },
      });

      const prefix = job.id.slice(0, 8);
      const result = await processGatewayLine(runtime, `job ${prefix}`);
      const text = result.output.join("");
      expect(text).toContain(job.id);
      expect(text).toContain("feat-b");
      expect(text).toContain("qa-engineer");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("job <id> reports unknown job", async () => {
    const { dir, runtime } = await createRuntime();
    try {
      const result = await processGatewayLine(runtime, "job deadbeef");
      expect(result.output.join("")).toContain('No job matching "deadbeef"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("health returns ok", async () => {
    const { dir, runtime } = await createRuntime();
    try {
      const result = await processGatewayLine(runtime, "health");
      expect(result.output).toEqual(["ok"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
