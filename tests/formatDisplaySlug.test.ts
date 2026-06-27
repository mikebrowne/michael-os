import { describe, expect, it } from "vitest";
import { formatDisplaySlug } from "../src/utils/formatDisplaySlug.js";

describe("formatDisplaySlug", () => {
  it('formats "example_slug" as "Example slug"', () => {
    expect(formatDisplaySlug("example_slug")).toBe("Example slug");
  });

  it('formats "another_example_slug" as "Another example slug"', () => {
    expect(formatDisplaySlug("another_example_slug")).toBe("Another example slug");
  });

  it("returns an empty string for empty input", () => {
    expect(formatDisplaySlug("")).toBe("");
  });

  it("returns an empty string for undefined input", () => {
    expect(formatDisplaySlug(undefined)).toBe("");
  });
});
