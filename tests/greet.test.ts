import { describe, expect, it } from "vitest";
import { greet } from "../src/utils/greet.js";

describe("greet", () => {
  it('returns "Hello, World!" for a normal name', () => {
    expect(greet("World")).toBe("Hello, World!");
  });

  it("returns a personalized greeting for any non-empty name", () => {
    expect(greet("Alice")).toBe("Hello, Alice!");
  });

  it("uses Guest when the name is an empty string", () => {
    expect(greet("")).toBe("Hello, Guest!");
  });

  it("uses Guest when the name is null", () => {
    expect(greet(null)).toBe("Hello, Guest!");
  });
});
