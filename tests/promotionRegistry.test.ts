import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPromotionRegistry } from "../src/engineering/promotionRegistry.js";

describe("promotionRegistry", () => {
  it("creates and lists promotion records", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-promo-"));
    const registry = createPromotionRegistry(join(dir, ".mastra"));
    try {
      const record = await registry.createPromotion({
        commitSha: "abc123",
        parentWorkItem: "feat-a",
        issueNumber: 1,
        prNumber: 10,
        branchName: "feature/feat-a-abc",
        gatesPassed: ["ci", "code-review"],
        gatesOverridden: [{ kind: "ci", overridden: false }],
      });

      expect(record.promotionNumber).toBe(1);
      expect(record.status).toBe("promoted");

      const byNumber = await registry.getPromotionByNumber(1);
      expect(byNumber?.commitSha).toBe("abc123");

      const list = await registry.listPromotions();
      expect(list).toHaveLength(1);
    } finally {
      await registry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
