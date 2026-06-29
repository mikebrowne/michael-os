import { describe, expect, it } from "vitest";
import {
  extractCitations,
  verifyCitation,
} from "../src/agentBuild/comprehension.js";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("comprehension", () => {
  it("extracts path citations from backticks", () => {
    const citations = extractCitations(
      "See `src/agentBuild/executor.ts` and `src/config/loadConfig.ts`.",
    );
    expect(citations).toHaveLength(2);
    expect(citations[0]?.path).toBe("src/agentBuild/executor.ts");
  });

  it("verifies existing path and symbol", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-comp-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(
        join(dir, "src", "foo.ts"),
        "export function greet() { return 'hi'; }\n",
        "utf-8",
      );
      const result = verifyCitation(dir, {
        path: "src/foo.ts",
        symbol: "greet",
      });
      expect(result.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails verification for missing path", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-comp-2-"));
    try {
      const result = verifyCitation(dir, { path: "missing.ts" });
      expect(result.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
