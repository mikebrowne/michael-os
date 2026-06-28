import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  redactString,
  redactUnknown,
  containsKnownSecret,
} from "../src/observability/redaction.js";
import {
  createObservabilityStore,
} from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";

describe("observability redaction", () => {
  it("redacts API key patterns", () => {
    const input = "key=sk-abcdefghijklmnopqrstuvwxyz1234567890";
    const redacted = redactString(input);
    expect(redacted).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(containsKnownSecret(redacted)).toBe(false);
  });

  it("redacts nested secret fields", () => {
    const result = redactUnknown({
      openaiApiKey: "sk-secretvalue12345678901234567890",
      message: "ok",
    }) as Record<string, unknown>;
    expect(result.openaiApiKey).toBe("[REDACTED]");
    expect(result.message).toBe("ok");
  });
});

describe("observability store", () => {
  it("writes redacted events to jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-obs-"));
    try {
      const store = createObservabilityStore({
        logDir: dir,
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "standard" }),
      });
      store.emit(
        "job.created",
        { jobId: "job-1" },
        { token: "sk-abcdefghijklmnopqrstuvwxyz1234567890" },
      );
      const content = readFileSync(store.getLogFilePath(), "utf-8");
      expect(content).toContain("job.created");
      expect(content).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("respects silent level", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-obs-silent-"));
    try {
      const store = createObservabilityStore({
        logDir: dir,
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "silent" }),
      });
      const event = store.emit("job.created", { jobId: "job-1" });
      expect(event).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
