import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runOnboardingSmokeTest } from "../src/authoring/engineeringAuthoringTools.js";

describe("onboarding smoke-test", () => {
  it("passes for a valid employee bundle", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-onboard-"));
    const bundleDir = join(dir, "agents", "demo-helper");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(
      join(bundleDir, "agent.md"),
      [
        "---",
        "id: demo-helper",
        "role: Demo Helper",
        "kind: mastra-agent",
        "authority: employee",
        "description: Onboarding test agent",
        "directChat: false",
        "standalone: true",
        "status: draft",
        "skills:",
        "  - author-policy",
        "---",
      ].join("\n"),
      "utf-8",
    );

    const result = runOnboardingSmokeTest(dir, "demo-helper");
    expect(result.passed).toBe(true);
  });

  it("fails when bundle is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-onboard-miss-"));
    const result = runOnboardingSmokeTest(dir, "missing-agent");
    expect(result.passed).toBe(false);
  });
});
