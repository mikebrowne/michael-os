import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createRunLogger } from "../src/logging/runLogger.js";

describe("RunLogger", () => {
  it("appends JSONL run log records to the configured directory", () => {
    const logDir = mkdtempSync(join(tmpdir(), "michael-os-logs-"));

    try {
      const logger = createRunLogger({ logDir, logLevel: "info" });
      logger.log({
        runId: "test-run-1",
        event: "test.event",
        data: { ok: true },
      });

      const lines = readFileSync(logger.getLogFilePath(), "utf-8")
        .trim()
        .split("\n");
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]!) as {
        runId: string;
        event: string;
        timestamp: string;
        data?: Record<string, unknown>;
      };
      expect(parsed.runId).toBe("test-run-1");
      expect(parsed.event).toBe("test.event");
      expect(parsed.data).toEqual({ ok: true });
      expect(parsed.timestamp).toBeTruthy();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });
});
