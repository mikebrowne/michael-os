import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createGatewayRouteState,
  switchActiveRoute,
  getThreadIdForRoute,
} from "../../src/gateway/gatewayRouteRegistry.js";
import {
  writeNecessityVerdict,
  readNecessityVerdict,
} from "../../src/engagement/necessityVerdict.js";
import { scanRegistriesForReuse } from "../../src/engagement/engagementTriageRegistry.js";

/**
 * Hash-locked north-star acceptance test for Phase 4b.
 * Proves multi-route switching + necessity verdict without live LLM.
 */
describe("Phase 4b multi-agent chat acceptance", () => {
  it("switches @skill-engineer route with distinct thread and records reuse verdict", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "michael-os-p4b-acc-"));
    try {
      const routeState = createGatewayRouteState("engineering-lead");
      const elThread = getThreadIdForRoute(routeState, "engineering-lead");

      const switched = switchActiveRoute(routeState, "skill-engineer");
      expect(switched.ok).toBe(true);
      const seThread = getThreadIdForRoute(routeState, "skill-engineer");
      expect(seThread).not.toBe(elThread);
      expect(routeState.activeAgentId).toBe("skill-engineer");

      const matches = scanRegistriesForReuse("grill skill to-prd");
      expect(matches.some((m) => m.kind === "skill")).toBe(true);

      writeNecessityVerdict(stateDir, {
        decision: "reuse",
        rationale: "Existing skills cover grill and PRD workflow.",
        sources: [
          {
            kind: "registry",
            summary: "Matched grill-me-with-docs and to-prd skills",
            refs: ["grill-me-with-docs", "to-prd"],
          },
        ],
        timestamp: "2026-07-01T12:00:00.000Z",
        routedTo: "engineering-lead",
        workItemSlug: "phase-4b-smoke",
      });

      const verdict = readNecessityVerdict(stateDir, "phase-4b-smoke");
      expect(verdict?.decision).toBe("reuse");
      expect(verdict?.sources[0]?.kind).toBe("registry");
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
