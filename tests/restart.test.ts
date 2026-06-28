import { describe, expect, it, afterEach } from "vitest";
import {
  RESTART_SENTINEL_EXIT_CODE,
  createRestartGate,
  executeControlledRestart,
  promotionTouchesHarness,
  restartLifecycleBus,
  type RestartLifecycleEvent,
} from "../src/gateway/restart.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("controlled restart", () => {
  afterEach(() => {
    restartLifecycleBus.removeAllListeners();
  });

  it("refuses new jobs during drain", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-restart-"));
    try {
      const observability = createObservabilityStore({
        logDir: join(dir, "logs"),
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "minimal" }),
      });
      const jobRegistry = createJobRegistry(join(dir, ".mastra"));
      const gate = createRestartGate();
      gate.beginDrain();

      const jobRunner = createJobRunner({
        jobRegistry,
        observability,
        restartGate: gate,
      });

      await expect(
        jobRunner.runCodeReviewJob({
          parentWorkItem: "feat",
          input: { workItemSlug: "feat" },
          executeReview: async () => ({
            decision: "approve",
            findings: [],
            rationale: "ok",
          }),
        }),
      ).rejects.toThrow(/draining/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("waits for in-flight jobs, persists marker, and exits with sentinel", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-restart-"));
    const markerPath = join(dir, ".mastra", "restart-marker.json");
    let exitCode: number | undefined;

    try {
      const gate = createRestartGate();
      gate.onJobStart();
      const lifecycle: RestartLifecycleEvent[] = [];
      restartLifecycleBus.on("lifecycle", (event: RestartLifecycleEvent) => {
        lifecycle.push(event);
      });

      const drainPromise = executeControlledRestart({
        restartGate: gate,
        persistState: () => {
          mkdirSync(join(dir, ".mastra"), { recursive: true });
          writeFileSync(markerPath, '{"drained":true}\n', "utf-8");
        },
        flushTelemetry: async () => {},
        getHeadCommitSha: () => "abc123def456",
        exitProcess: (code) => {
          exitCode = code;
        },
        waitForDrainMs: 10,
      });

      gate.onJobEnd();
      await drainPromise;

      expect(exitCode).toBe(RESTART_SENTINEL_EXIT_CODE);
      expect(existsSync(markerPath)).toBe(true);
      expect(JSON.parse(readFileSync(markerPath, "utf-8"))).toEqual({
        drained: true,
      });
      expect(lifecycle.map((e) => e.type)).toEqual([
        "restarting",
        "down",
      ]);
      expect(lifecycle[0]).toMatchObject({ type: "restarting", inFlight: 1 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits restarting, down, and up lifecycle messages", () => {
    const events: RestartLifecycleEvent[] = [];
    restartLifecycleBus.on("lifecycle", (event: RestartLifecycleEvent) => {
      events.push(event);
    });

    restartLifecycleBus.emit("lifecycle", {
      type: "restarting",
      inFlight: 2,
    } satisfies RestartLifecycleEvent);
    restartLifecycleBus.emit("lifecycle", { type: "down" } satisfies RestartLifecycleEvent);
    restartLifecycleBus.emit("lifecycle", {
      type: "up",
      commitSha: "deadbeef",
    } satisfies RestartLifecycleEvent);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: "restarting", inFlight: 2 });
    expect(events[1]).toMatchObject({ type: "down" });
    expect(events[2]).toMatchObject({ type: "up", commitSha: "deadbeef" });
  });

  it("suggests restart when promotion touches src/**", () => {
    expect(
      promotionTouchesHarness(["src/engineering/staging.ts", "docs/foo.md"]),
    ).toBe(true);
    expect(promotionTouchesHarness(["docs/foo.md", "tests/bar.test.ts"])).toBe(
      false,
    );
  });
});
