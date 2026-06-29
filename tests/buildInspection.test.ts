import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readWorktreeFile,
  tailBuildLog,
} from "../src/agentBuild/buildInspection.js";

describe("buildInspection", () => {
  it("reads a file within the worktree", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-inspect-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "x.ts"), "export const x = 1;\n", "utf-8");
      const result = readWorktreeFile(dir, "src/x.ts");
      expect(result.content).toContain("export const x");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects path traversal", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-inspect-2-"));
    try {
      expect(() => readWorktreeFile(dir, "../../etc/passwd")).toThrow(
        "escapes worktree",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tails build log when present", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-inspect-3-"));
    try {
      writeFileSync(join(dir, "build.log"), "line1\nline2\nline3\n", "utf-8");
      const tailed = tailBuildLog(dir, 2);
      expect(tailed.content).toContain("line2");
      expect(tailed.content).toContain("line3");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
