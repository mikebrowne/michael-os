import { describe, expect, it, vi } from "vitest";
import {
  buildStreamBus,
  formatBuildStreamMessage,
} from "../src/agentBuild/buildStreamBus.js";
import { isBuildInFlight } from "../src/agentBuild/steerableBuild.js";

describe("buildStreamBus", () => {
  it("formats stream messages for gateway broadcast", () => {
    const formatted = formatBuildStreamMessage({
      slug: "feat",
      kind: "todo",
      message: "Todos updated",
    });
    expect(formatted).toContain("[build todo]");
    expect(formatted).toContain("feat");
  });

  it("notifies listeners on emit", () => {
    const listener = vi.fn();
    const off = buildStreamBus.onStream(listener);
    buildStreamBus.emitEvent({
      slug: "x",
      kind: "progress",
      message: "working",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});

describe("steerableBuild in-flight tracking", () => {
  it("reports not in flight for unknown slug", () => {
    expect(isBuildInFlight("nonexistent-slug-xyz")).toBe(false);
  });
});
