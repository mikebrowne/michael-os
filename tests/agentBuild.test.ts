import { describe, expect, it } from "vitest";
import { slugifyRequest, formatRunTimestamp } from "../src/agentBuild/runDir.js";
import {
  evaluateRedGreenGates,
  hashFile,
  verifyAcceptanceHash,
} from "../src/agentBuild/gates.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("agentBuild runDir", () => {
  it("slugifies requests", () => {
    expect(slugifyRequest("Add a jobs table API")).toBe("add-a-jobs-table-api");
    expect(slugifyRequest("!!!")).toBe("task");
  });

  it("formats run timestamps", () => {
    const ts = formatRunTimestamp(new Date("2026-06-27T15:04:00"));
    expect(ts).toBe("2026-06-27-1504");
  });
});

describe("agentBuild gates", () => {
  it("evaluates red/green gate outcomes", () => {
    const outcome = evaluateRedGreenGates(
      { passed: false, exitCode: 1, log: "fail" },
      { passed: true, exitCode: 0, log: "ok" },
      true,
    );
    expect(outcome.redGateValid).toBe(true);
    expect(outcome.greenGateValid).toBe(true);
  });

  it("flags tautological red gate", () => {
    const outcome = evaluateRedGreenGates(
      { passed: true, exitCode: 0, log: "unexpected pass" },
      { passed: true, exitCode: 0, log: "ok" },
      true,
    );
    expect(outcome.redGateValid).toBe(false);
  });

  it("detects acceptance test hash changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-hash-"));
    const file = join(dir, "acceptance.test.ts");
    try {
      writeFileSync(file, "export const x = 1;\n", "utf-8");
      const hash = hashFile(file);
      writeFileSync(file, "export const x = 2;\n", "utf-8");
      expect(verifyAcceptanceHash(file, hash)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
