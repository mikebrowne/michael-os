import { createIssue, type GhRunner } from "../engineering/github.js";
import type {
  AuthoringForm,
  AuthoringProposalInput,
  AuthoringProposalResult,
} from "./authoringTypes.js";

export function formatProposalIssueBody(input: AuthoringProposalInput): string {
  return [
    "## User story",
    "",
    input.userStory,
    "",
    "## Recommended form",
    "",
    `**${input.recommendedForm}** — ${input.rationale}`,
    "",
    "## Technical detail",
    "",
    input.technicalDetail,
    "",
    "## Non-technical detail",
    "",
    input.nonTechnicalDetail,
    "",
    "## Proposal gate",
    "",
    "This Issue is a **pending proposal** — review and reply YES to take on this project before any artifact is built.",
    "",
    "This issue contains no secrets or private data.",
  ].join("\n");
}

export function formatProposalTitle(title: string, form: AuthoringForm): string {
  const prefix = `[authoring:${form}]`;
  return title.startsWith("[") ? title : `${prefix} ${title}`;
}

export async function draftAuthoringProposal(
  ghRunner: GhRunner,
  githubRepo: string,
  input: AuthoringProposalInput,
): Promise<AuthoringProposalResult> {
  const body = formatProposalIssueBody(input);
  const title = formatProposalTitle(input.title, input.recommendedForm);
  const labels = ["authoring-proposal", ...(input.labels ?? [])];

  const { issueNumber, stdout } = await createIssue(ghRunner, githubRepo, {
    title,
    body,
    labels,
  });

  return {
    issueNumber,
    title,
    body,
    urlHint: issueNumber
      ? `https://github.com/${githubRepo}/issues/${issueNumber}`
      : stdout.trim(),
  };
}
