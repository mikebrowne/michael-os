import { describe, expect, it } from "vitest";
import { processGatewayLine } from "../src/gateway/session.js";
import { getThreadIdForRoute } from "../src/gateway/gatewayRouteRegistry.js";
import {
  cleanupTestGateway,
  createTestGatewayRuntime,
} from "./gatewayTestHarness.js";

describe("gateway session commands", () => {
  it("jobs lists recent job records", async () => {
    const { dir, ctx, runtime } = await createTestGatewayRuntime();
    try {
      await ctx.jobRegistry.createJob({
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
      cleanupTestGateway(dir);
    }
  });

  it("jobs reports empty when no records exist", async () => {
    const { dir, runtime } = await createTestGatewayRuntime();
    try {
      const result = await processGatewayLine(runtime, "jobs");
      expect(result.output.join("")).toContain("No jobs found");
    } finally {
      cleanupTestGateway(dir);
    }
  });

  it("job <id> shows job detail by prefix", async () => {
    const { dir, ctx, runtime } = await createTestGatewayRuntime();
    try {
      const job = await ctx.jobRegistry.createJob({
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
      cleanupTestGateway(dir);
    }
  });

  it("job <id> reports unknown job", async () => {
    const { dir, runtime } = await createTestGatewayRuntime();
    try {
      const result = await processGatewayLine(runtime, "job deadbeef");
      expect(result.output.join("")).toContain('No job matching "deadbeef"');
    } finally {
      cleanupTestGateway(dir);
    }
  });

  it("health returns ok", async () => {
    const { dir, runtime } = await createTestGatewayRuntime();
    try {
      const result = await processGatewayLine(runtime, "health");
      expect(result.output).toEqual(["ok"]);
    } finally {
      cleanupTestGateway(dir);
    }
  });

  it("@skill-engineer switches route and thread", async () => {
    const { dir, runtime } = await createTestGatewayRuntime();
    try {
      const beforeThread = getThreadIdForRoute(
        runtime.routeState,
        runtime.routeState.activeAgentId,
      );
      const result = await processGatewayLine(runtime, "@skill-engineer");
      const afterThread = getThreadIdForRoute(
        runtime.routeState,
        "skill-engineer",
      );
      expect(result.output.join("")).toContain("@skill-engineer");
      expect(runtime.routeState.activeAgentId).toBe("skill-engineer");
      expect(afterThread).not.toBe(beforeThread);
      expect(afterThread).toBe("thread-skill-engineer");
    } finally {
      cleanupTestGateway(dir);
    }
  });

  it("agents lists direct-chat agents from registry", async () => {
    const { dir, runtime } = await createTestGatewayRuntime();
    try {
      const result = await processGatewayLine(runtime, "agents");
      const text = result.output.join("");
      expect(text).toContain("@engineering-lead");
      expect(text).toContain("@skill-engineer");
      expect(text).toContain("@engagement-manager");
    } finally {
      cleanupTestGateway(dir);
    }
  });
});
