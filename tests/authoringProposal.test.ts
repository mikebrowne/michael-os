import { describe, expect, it } from "vitest";
import {
  formatProposalIssueBody,
  formatProposalTitle,
} from "../src/authoring/authoringProposal.js";

describe("authoring proposal gate", () => {
  it("formats a well-formed backlog Issue body", () => {
    const body = formatProposalIssueBody({
      title: "Harden greet skill",
      userStory: "As the operator, I want greet logic in a tool so it is faster.",
      technicalDetail: "Add src/mastra/tools/greet.ts with testMode mock.",
      nonTechnicalDetail: "The skill is hot; hardening reduces LLM calls.",
      recommendedForm: "tool",
      rationale: "Happy path is understood; ratchet to deterministic code.",
    });

    expect(body).toContain("## User story");
    expect(body).toContain("## Technical detail");
    expect(body).toContain("## Non-technical detail");
    expect(body).toContain("**tool**");
    expect(body).toContain("pending proposal");
  });

  it("prefixes proposal titles with authoring form", () => {
    expect(formatProposalTitle("Hot greet", "tool")).toBe(
      "[authoring:tool] Hot greet",
    );
  });
});
