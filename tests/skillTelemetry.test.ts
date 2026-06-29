import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createObservabilityStore,
} from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import {
  createSkillTelemetry,
  SKILL_TELEMETRY_EVENTS,
} from "../src/skills/skillTelemetry.js";
import { validateSkill } from "../src/skills/skillRegistry.js";
import { containsKnownSecret } from "../src/observability/redaction.js";

const REPO_ROOT = process.cwd();

function parseJsonl(path: string): Array<{ event: string; correlation: Record<string, unknown>; data?: Record<string, unknown> }> {
  return readFileSync(path, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event: string; correlation: Record<string, unknown>; data?: Record<string, unknown> });
}

describe("skillTelemetry", () => {
  it("registers all five skill.* event names", () => {
    expect(SKILL_TELEMETRY_EVENTS).toEqual([
      "skill.activated",
      "skill.tool_invoked",
      "skill.validated",
      "skill.changed",
      "skill.activation_failed",
    ]);
  });

  it("emits all five events with job/trace correlation", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-telem-"));
    try {
      const store = createObservabilityStore({
        logDir: dir,
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "standard" }),
      });
      const telemetry = createSkillTelemetry(store);
      const correlation = {
        jobId: "job-abc",
        traceId: "trace-xyz",
        sessionId: store.sessionId,
      };

      telemetry.activated("code-review", "qa-engineer", correlation);
      telemetry.toolInvoked("code-review", "review-build", {
        mocked: true,
        correlation,
      });
      telemetry.validated("ship", true, [], correlation);
      telemetry.changed("ship", "edit", "active", correlation);
      telemetry.activationFailed(
        "write-skill",
        "qa-engineer",
        "out of scope",
        correlation,
      );

      const events = parseJsonl(store.getLogFilePath());
      for (const name of SKILL_TELEMETRY_EVENTS) {
        expect(events.some((e) => e.event === name)).toBe(true);
      }

      const activated = events.find((e) => e.event === "skill.activated")!;
      expect(activated.correlation.jobId).toBe("job-abc");
      expect(activated.correlation.traceId).toBe("trace-xyz");
      expect(activated.data?.skillName).toBe("code-review");

      const toolInvoked = events.find((e) => e.event === "skill.tool_invoked")!;
      expect(toolInvoked.data?.mocked).toBe(true);

      const failed = events.find((e) => e.event === "skill.activation_failed")!;
      expect(failed.data?.reason).toContain("out of scope");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validateSkill emits skill.validated via telemetry hook", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-valid-telem-"));
    try {
      const store = createObservabilityStore({
        logDir: dir,
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "standard" }),
      });
      const telemetry = createSkillTelemetry(store);
      validateSkill(REPO_ROOT, "ship", telemetry, { jobId: "job-1" });
      const events = parseJsonl(store.getLogFilePath());
      const validated = events.find((e) => e.event === "skill.validated");
      expect(validated?.data?.valid).toBe(true);
      expect(validated?.data?.skillName).toBe("ship");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not emit secrets in skill telemetry payloads", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-telem-redact-"));
    try {
      const store = createObservabilityStore({
        logDir: dir,
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "standard" }),
      });
      const telemetry = createSkillTelemetry(store);
      telemetry.validated("x", false, ["token=sk-abcdefghijklmnopqrstuvwxyz1234567890"]);
      const content = readFileSync(store.getLogFilePath(), "utf-8");
      expect(content).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
      expect(containsKnownSecret(content)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
