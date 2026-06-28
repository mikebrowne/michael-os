import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config/loadConfig.js";
import { createMastraHarness } from "../src/mastra/mastraHarness.js";
import { resetMastraStorageForTests } from "../src/mastra/mastraStorage.js";
import { resetAgentMemoryForTests } from "../src/mastra/agentMemory.js";

describe("mastraHarness", () => {
  afterEach(() => {
    resetMastraStorageForTests();
    resetAgentMemoryForTests();
  });

  it("boots harness with agents and synchronous jobRunner", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-harness-"));
    try {
      const base = loadConfig();
      const config = {
        ...base,
        logDir: join(dir, "logs"),
        mastraDir: join(dir, ".mastra"),
        stateDir: join(dir, "state"),
      };

      const harness = createMastraHarness(config, process.cwd());

      expect(harness.engineeringLeadAgent.id).toBe("engineering-lead");
      expect(harness.codeReviewerAgent.id).toBe("code-reviewer");
      expect(harness.jobRunner).toBeDefined();
      expect(harness.engineeringSession.jobRunner).toBe(harness.jobRunner);

      const ids = harness.agentRegistry.map((a) => a.id);
      expect(ids).toContain("engineering-lead");
      expect(ids).toContain("code-reviewer");

      expect(
        "setBackgroundTaskManager" in harness.jobRunner,
      ).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
