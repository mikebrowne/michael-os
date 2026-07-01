import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { grantPendingApproval } from "../src/engineering/approvalGate.js";
import { createSkillEngineerTools } from "../src/mastra/tools/skillEngineer/index.js";
import { createSkillEngineerSessionContext } from "../src/skills/skillEngineerSession.js";
import { loadConfig } from "../src/config/loadConfig.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";

describe("skill author", () => {
  it("blocks activation without eval and without operator yes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-author-"));
    const config = {
      ...loadConfig(),
      stateDir: join(dir, "state"),
      mastraDir: join(dir, ".mastra"),
      logDir: join(dir, "logs"),
    };

    const observability = createObservabilityStore({
      logDir: config.logDir,
      mastraDir: config.mastraDir,
      config: createObservabilityConfig({ level: "standard" }),
    });

    const ctx = createSkillEngineerSessionContext(config, {
      repoPath: dir,
      observability,
      ghRunner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    const tools = createSkillEngineerTools(ctx);

    mkdirSync(join(dir, "skills", "demo-author-skill"), { recursive: true });
    writeFileSync(
      join(dir, "skills", "demo-author-skill", "SKILL.md"),
      [
        "---",
        "name: demo-author-skill",
        "description: Demo skill for author test",
        "metadata:",
        "  scope: [skill-engineer]",
        "  allowed-tools: []",
        "  allowed-workflows: []",
        "  status: active",
        "  tags: [demo]",
        "---",
        "",
        "# Demo skill",
        "",
        "Returns demo guidance for the operator.",
      ].join("\n"),
      "utf-8",
    );

    const blockedNoEval = await tools.activateSkill.execute!(
      { name: "demo-author-skill" },
      {} as never,
    );
    expect((blockedNoEval as { blocked?: boolean }).blocked).toBe(true);

    mkdirSync(join(dir, "skills", "demo-author-skill", "evals"), {
      recursive: true,
    });
    writeFileSync(
      join(dir, "skills", "demo-author-skill", "evals", "basic.json"),
      JSON.stringify({
        input: "demo",
        expectedBehavior: "Returns demo guidance",
        assertions: ["Demo"],
      }),
      "utf-8",
    );

    const needsApproval = await tools.activateSkill.execute!(
      { name: "demo-author-skill" },
      {} as never,
    );
    expect((needsApproval as { needsApproval?: boolean }).needsApproval).toBe(
      true,
    );

    grantPendingApproval(ctx.approval);
    const activated = await tools.activateSkill.execute!(
      { name: "demo-author-skill" },
      {} as never,
    );
    expect((activated as { activated?: boolean }).activated).toBe(true);
  });
});
