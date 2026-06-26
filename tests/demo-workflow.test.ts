import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createRunLogger } from "../src/logging/runLogger.js";
import { runDemoWorkflow } from "../src/mastra/workflows/demo-workflow.js";

describe("demo workflow", () => {
  it("summarizes the first note in the Demo vault without any LLM key", async () => {
    const vaultPath = mkdtempSync(join(tmpdir(), "michael-os-vault-"));
    const logDir = mkdtempSync(join(tmpdir(), "michael-os-logs-"));

    try {
      writeFileSync(
        join(vaultPath, "sample.md"),
        "# Sample Note\n\nMichaelOS builds thin vertical slices.\n",
        "utf-8",
      );

      const runLogger = createRunLogger({ logDir, logLevel: "info" });
      const result = await runDemoWorkflow(vaultPath, "test-run-2", runLogger);

      expect(result.noteTitle).toBe("Sample Note");
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.preview).toContain("MichaelOS");
      expect(result.vaultPath).toBe(vaultPath);
    } finally {
      rmSync(vaultPath, { recursive: true, force: true });
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("falls back to the committed Demo vault when VAULT_PATH is unset", async () => {
    const { loadConfig } = await import("../src/config/loadConfig.js");
    const config = loadConfig(process.cwd());
    expect(config.vaultPath).toContain("examples");
    expect(config.vaultPath).toContain("demo-vault");
  });
});
