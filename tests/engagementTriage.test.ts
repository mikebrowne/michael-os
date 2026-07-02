import { describe, expect, it } from "vitest";
import { scanRegistriesForReuse } from "../src/engagement/engagementTriageRegistry.js";
import {
  formatNecessityVerdictSummary,
  readNecessityVerdict,
  writeNecessityVerdict,
} from "../src/engagement/necessityVerdict.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("engagement triage registry scan", () => {
  it("finds skill-engineer related registry matches deterministically", () => {
    const matches = scanRegistriesForReuse("skill authoring validate SKILL");
    expect(matches.length).toBeGreaterThan(0);
    const skillMatch = matches.find((m) => m.id === "skill-engineer" || m.kind === "skill");
    expect(skillMatch).toBeDefined();
  });
});

describe("necessity verdict artifact", () => {
  it("writes and reads necessity-verdict.md with expected schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-verdict-"));
    try {
      const verdict = writeNecessityVerdict(dir, {
        decision: "reuse",
        rationale: "Existing skill covers the need.",
        sources: [
          { kind: "registry", summary: "Matched write-skill skill bundle" },
        ],
        timestamp: "2026-07-01T12:00:00.000Z",
        routedTo: "skill-engineer",
        workItemSlug: "feat-skill-reuse",
      });

      expect(verdict).toContain("necessity-verdict.md");
      const roundTrip = readNecessityVerdict(dir, "feat-skill-reuse");
      expect(roundTrip?.decision).toBe("reuse");
      expect(roundTrip?.routedTo).toBe("skill-engineer");
      expect(formatNecessityVerdictSummary(roundTrip!)).toContain("reuse");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
