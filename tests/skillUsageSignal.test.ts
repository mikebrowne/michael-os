import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  aggregateSkillActivationsFromJsonl,
  findHotSkills,
  isHotSkill,
} from "../src/authoring/skillUsageSignal.js";

describe("skill usage signal", () => {
  it("aggregates skill.activated events from JSONL", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-usage-"));
    const logPath = join(dir, "observability.jsonl");
    writeFileSync(
      logPath,
      [
        JSON.stringify({
          event: "skill.activated",
          data: { skillName: "code-review" },
        }),
        JSON.stringify({
          event: "skill.activated",
          data: { skillName: "code-review" },
        }),
        JSON.stringify({
          event: "skill.activated",
          data: { skillName: "grill-me-with-docs" },
        }),
      ].join("\n"),
      "utf-8",
    );

    const counts = aggregateSkillActivationsFromJsonl(logPath);
    expect(counts.get("code-review")).toBe(2);
    expect(isHotSkill("code-review", counts, 2)).toBe(true);
    expect(findHotSkills(counts, 2)).toContain("code-review");
  });
});
