import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createGatewayRouteState,
  loadGatewayRouteState,
  saveGatewayRouteState,
  switchActiveRoute,
  getThreadIdForRoute,
  parseAgentSwitchCommand,
} from "../src/gateway/gatewayRouteRegistry.js";

describe("gatewayRouteRegistry", () => {
  it("parseAgentSwitchCommand extracts agent id", () => {
    expect(parseAgentSwitchCommand("@skill-engineer")).toBe("skill-engineer");
    expect(parseAgentSwitchCommand("@Engineering-Lead")).toBe("engineering-lead");
    expect(parseAgentSwitchCommand("hello")).toBeUndefined();
  });

  it("persists route state to gateway-routes.json", () => {
    const repo = process.cwd();
    const statePath = join(repo, ".mastra", "gateway-routes.json");
    let backup: string | undefined;
    if (existsSync(statePath)) {
      backup = readFileSync(statePath, "utf-8");
    }
    try {
      const state = createGatewayRouteState("engineering-lead");
      switchActiveRoute(state, "skill-engineer", repo);
      saveGatewayRouteState(repo, state);

      expect(existsSync(statePath)).toBe(true);
      const loaded = loadGatewayRouteState(repo);
      expect(loaded.activeAgentId).toBe("skill-engineer");
      expect(loaded.threads["skill-engineer"]).toBeDefined();
    } finally {
      if (backup !== undefined) {
        writeFileSync(statePath, backup, "utf-8");
      } else if (existsSync(statePath)) {
        rmSync(statePath);
      }
    }
  });

  it("assigns distinct threads per route", () => {
    const state = createGatewayRouteState("engagement-manager");
    const emThread = getThreadIdForRoute(state, "engagement-manager");
    switchActiveRoute(state, "engineering-lead");
    const elThread = getThreadIdForRoute(state, "engineering-lead");
    expect(emThread).not.toBe(elThread);
  });
});
